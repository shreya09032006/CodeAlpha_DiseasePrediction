"""Train an ECG-image classifier (transfer learning).

Run from backend/ with the venv active:
    python train_ecg.py --data ../ecg_data

Classes (from the folder names): normal, abnormal_heartbeat, mi, history_mi
Output: models/ecg_model.pt, models/ecg_meta.json
"""
import argparse
import json
import random
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from torchvision import models
from torchvision.transforms import v2

CLASSES = ["normal", "abnormal_heartbeat", "mi", "history_mi"]
SIZE = (224, 320)  # height, width: ECG sheets are wide
MEAN, STD = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]


def label_of(folder: str):
    f = folder.lower()
    if "history" in f:
        return "history_mi"
    if "myocardial" in f:
        return "mi"
    if "abnormal" in f:
        return "abnormal_heartbeat"
    if "normal" in f:
        return "normal"
    return None


def load_images(root: Path, per_class=None):
    X, y, names = [], [], []
    for d in sorted(p for p in root.rglob("*") if p.is_dir()):
        lab = label_of(d.name)
        files = sorted(f for f in d.iterdir() if f.suffix.lower() in (".jpg", ".jpeg", ".png"))
        if lab is None or not files:
            continue
        if per_class:
            files = files[:per_class]
        print(f"  {lab:20} {len(files):4} images  <- {d.name}")
        for f in files:
            img = Image.open(f).convert("RGB").resize((SIZE[1], SIZE[0]), Image.BILINEAR)
            X.append(torch.from_numpy(np.array(img)).permute(2, 0, 1).contiguous())  # uint8 CxHxW
            y.append(CLASSES.index(lab))
            names.append(f.name)
    if not X:
        raise SystemExit(f"No images found under {root}. Check the --data path.")
    return torch.stack(X), torch.tensor(y), names


def build(pretrained: bool):
    m = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.IMAGENET1K_V1 if pretrained else None)
    m.classifier = nn.Sequential(nn.Dropout(0.3), nn.Linear(m.classifier[1].in_features, len(CLASSES)))
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="../ecg_data")
    ap.add_argument("--epochs", type=int, default=14)
    ap.add_argument("--head-epochs", type=int, default=4)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--no-pretrained", action="store_true", help="test only: skip downloading weights")
    ap.add_argument("--quick", action="store_true", help="test only: tiny run")
    a = ap.parse_args()

    random.seed(42); np.random.seed(42); torch.manual_seed(42)
    device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
    print("Device:", device)
    print("Loading images (resized once, kept in memory)...")
    X, y, _ = load_images(Path(a.data), per_class=6 if a.quick else None)

    idx = np.arange(len(y))
    tr, rest = train_test_split(idx, test_size=0.30, stratify=y.numpy(), random_state=42)
    va, te = train_test_split(rest, test_size=0.50, stratify=y.numpy()[rest], random_state=42)
    print(f"Split: train {len(tr)}, val {len(va)}, test {len(te)}")

    aug = v2.Compose([
        v2.RandomAffine(degrees=3, translate=(0.02, 0.02), scale=(0.95, 1.05)),
        v2.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.15),
    ])
    norm = v2.Compose([v2.ToDtype(torch.float32, scale=True), v2.Normalize(MEAN, STD)])

    def batch_of(ids, train):
        xb = X[ids]
        if train:
            xb = torch.stack([aug(img) for img in xb])
        return norm(xb).to(device), y[ids].to(device)

    counts = np.bincount(y[tr].numpy(), minlength=len(CLASSES))
    weights = torch.tensor(len(tr) / (len(CLASSES) * np.maximum(counts, 1)), dtype=torch.float32).to(device)
    loss_fn = nn.CrossEntropyLoss(weight=weights, label_smoothing=0.05)
    model = build(not a.no_pretrained).to(device)

    def evaluate(ids):
        model.eval(); preds = []
        with torch.no_grad():
            for i in range(0, len(ids), 32):
                xb, _ = batch_of(ids[i:i + 32], False)
                preds.append(model(xb).argmax(1).cpu())
        p = torch.cat(preds).numpy()
        t = y[ids].numpy()
        return float((p == t).mean()), float(f1_score(t, p, average="macro")), p, t

    epochs = 1 if a.quick else a.epochs
    head_epochs = 0 if a.quick else a.head_epochs
    best_f1, best_state, t0 = -1, None, time.time()
    opt = None
    for ep in range(epochs):
        if ep == 0 or ep == head_epochs:
            frozen = ep < head_epochs
            for p in model.features.parameters():
                p.requires_grad = not frozen
            params = [p for p in model.parameters() if p.requires_grad]
            opt = torch.optim.AdamW(params, lr=1e-3 if frozen else 1e-4, weight_decay=1e-4)
            sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, epochs - ep))
            print("Training the new head only..." if frozen else "Fine-tuning the whole network...")
        model.train()
        order = np.random.permutation(tr); total = 0.0
        for i in range(0, len(order), a.batch):
            xb, yb = batch_of(order[i:i + a.batch], True)
            opt.zero_grad(); loss = loss_fn(model(xb), yb); loss.backward(); opt.step()
            total += loss.item() * len(yb)
        sched.step()
        acc, f1, _, _ = evaluate(va)
        print(f"epoch {ep + 1:2}/{epochs}  loss {total / len(tr):.3f}  val acc {acc:.3f}  val macro-F1 {f1:.3f}  ({time.time() - t0:.0f}s)")
        if f1 > best_f1:
            best_f1, best_state = f1, {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

    model.load_state_dict(best_state)
    acc, f1, p, t = evaluate(te)
    print(f"\nTEST accuracy {acc:.3f}   macro-F1 {f1:.3f}   (images the model never saw)")
    labels = list(range(len(CLASSES)))
    print(classification_report(t, p, labels=labels, target_names=CLASSES, zero_division=0))
    print("Confusion matrix (rows = true, columns = predicted):")
    print(confusion_matrix(t, p, labels=labels))

    out = Path("models"); out.mkdir(exist_ok=True)
    if not a.quick:
        torch.save(best_state, out / "ecg_model.pt")
        json.dump({
            "classes": CLASSES, "size": list(SIZE), "mean": MEAN, "std": STD, "arch": "efficientnet_b0",
            "test_accuracy": round(acc, 4), "test_macro_f1": round(f1, 4), "trained_on_images": int(len(tr)),
        }, open(out / "ecg_meta.json", "w"), indent=2)
        print("\nSaved models/ecg_model.pt and models/ecg_meta.json")


if __name__ == "__main__":
    main()

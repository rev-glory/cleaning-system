from ultralytics import YOLO
import torch

# Load a single instance of the Nano model for both detection and privacy
shared_model = YOLO("yolov8n-seg.pt")
torch.set_grad_enabled(False) # Disable gradients for inference memory savings
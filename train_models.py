import pandas as pd
import numpy as np
import time
from sklearn.ensemble import IsolationForest
from sklearn.metrics import precision_score, recall_score, f1_score
from sklearn.preprocessing import StandardScaler
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, RepeatVector, TimeDistributed
import matplotlib.pyplot as plt

# 1. Explanation:
# Isolation Forest: Works by isolating anomalies through random partitioning. 
# It's excellent for tabular data because anomalies are "few and different", 
# meaning they require fewer splits to isolate than normal points.
#
# LSTM Autoencoder: Learns the "normal" temporal patterns of a sequence. 
# By reconstructing the input, it can identify anomalies as sequences with 
# high reconstruction error. It's superior for time-series because it 
# understands the context of previous readings.

def create_sequences(data, time_steps=10):
    """Creates sequences for LSTM input."""
    xs = []
    for i in range(len(data) - time_steps):
        xs.append(data[i:(i + time_steps)])
    return np.array(xs)

def train_isolation_forest(X_train, X_test, y_test):
    """Baseline model using Isolation Forest."""
    print("\n--- Training Isolation Forest ---")
    model = IsolationForest(contamination=0.05, random_state=42)
    model.fit(X_train)
    
    # Inference
    start_time = time.time()
    preds = model.predict(X_test)
    latency = (time.time() - start_time) / len(X_test)
    
    # Map -1 (anomaly) to 1, and 1 (normal) to 0
    y_pred = [1 if x == -1 else 0 for x in preds]
    
    print(f"Inference Latency: {latency*1000:.4f} ms/sample")
    return model, y_pred

def train_lstm_autoencoder(X_train_scaled, X_test_scaled, time_steps=10):
    """Advanced model using LSTM Autoencoder."""
    print("\n--- Training LSTM Autoencoder ---")
    
    # Prepare sequences
    X_train_seq = create_sequences(X_train_scaled, time_steps)
    X_test_seq = create_sequences(X_test_scaled, time_steps)
    
    # Model Architecture
    model = Sequential([
        LSTM(32, activation='relu', input_shape=(X_train_seq.shape[1], X_train_seq.shape[2]), return_sequences=False),
        RepeatVector(X_train_seq.shape[1]),
        LSTM(32, activation='relu', return_sequences=True),
        TimeDistributed(Dense(X_train_seq.shape[2]))
    ])
    
    model.compile(optimizer='adam', loss='mae')
    
    # Train (using subset for speed in hackathon context)
    model.fit(X_train_seq, X_train_seq, epochs=5, batch_size=32, validation_split=0.1, verbose=1)
    
    # Inference & Anomaly Scoring
    start_time = time.time()
    X_test_pred = model.predict(X_test_seq)
    latency = (time.time() - start_time) / len(X_test_seq)
    
    # Calculate reconstruction error
    test_mae_loss = np.mean(np.abs(X_test_pred - X_test_seq), axis=(1, 2))
    
    # Set threshold (e.g., 95th percentile of training loss)
    threshold = np.percentile(test_mae_loss, 95)
    y_pred = [1 if loss > threshold else 0 for loss in test_mae_loss]
    
    print(f"Inference Latency: {latency*1000:.4f} ms/sample")
    return model, y_pred, threshold, test_mae_loss

def evaluate_model(y_true, y_pred, name):
    """Prints evaluation metrics."""
    print(f"\nEvaluation for {name}:")
    print(f"Precision: {precision_score(y_true, y_pred):.4f}")
    print(f"Recall:    {recall_score(y_true, y_pred):.4f}")
    print(f"F1-Score:  {f1_score(y_true, y_pred):.4f}")

def predict_realtime(new_reading, scaler, iso_forest, lstm_model, sequence_buffer, threshold, time_steps=10):
    """Predicts anomaly for a single new reading instantly."""
    start_time = time.time()
    
    # Preprocess
    reading_scaled = scaler.transform([new_reading])
    
    # Isolation Forest Prediction
    iso_pred = 1 if iso_forest.predict(reading_scaled)[0] == -1 else 0
    
    # LSTM Prediction (requires buffer)
    lstm_pred = 0
    if len(sequence_buffer) >= time_steps:
        seq = np.array([sequence_buffer[-time_steps:]])
        reconstruction = lstm_model.predict(seq, verbose=0)
        loss = np.mean(np.abs(reconstruction - seq))
        lstm_pred = 1 if loss > threshold else 0
    
    # Hybrid: Flag if either model detects anomaly
    final_pred = 1 if (iso_pred or lstm_pred) else 0
    
    latency = time.time() - start_time
    return {
        'anomaly': final_pred,
        'iso_score': iso_pred,
        'lstm_score': lstm_pred,
        'latency_ms': latency * 1000
    }

if __name__ == "__main__":
    from generate_dataset import generate_water_quality_dataset, preprocess_and_split
    
    # 1. Data Pipeline
    df = generate_water_quality_dataset(hours=24)
    X_train, X_test, y_train, y_test, scaler = preprocess_and_split(df)
    
    # 2. Train Models
    iso_forest, iso_preds = train_isolation_forest(X_train, X_test, y_test)
    
    # For LSTM, we need the full scaled data to maintain sequence
    X_scaled = scaler.transform(df[['ph', 'turbidity', 'tds', 'chlorine']])
    split_idx = int(len(X_scaled) * 0.8)
    X_train_scaled = X_scaled[:split_idx]
    X_test_scaled = X_scaled[split_idx:]
    y_test_lstm = df['anomaly_label'].values[split_idx+10:] # Adjust for sequence offset
    
    lstm_model, lstm_preds, threshold, losses = train_lstm_autoencoder(X_train_scaled, X_test_scaled)
    
    # 3. Evaluation
    evaluate_model(y_test, iso_preds, "Isolation Forest")
    evaluate_model(y_test_lstm, lstm_preds[:len(y_test_lstm)], "LSTM Autoencoder")
    
    # 4. Real-time Simulation
    print("\n--- Real-time Inference Test ---")
    sample_reading = [7.2, 2.5, 150, 0.6] # Normal
    buffer = X_test_scaled[:10].tolist()
    result = predict_realtime(sample_reading, scaler, iso_forest, lstm_model, buffer, threshold)
    print(f"Prediction for normal reading: {result}")
    
    anomaly_reading = [5.5, 15.0, 150, 0.1] # High turbidity, low pH, low chlorine
    result = predict_realtime(anomaly_reading, scaler, iso_forest, lstm_model, buffer, threshold)
    print(f"Prediction for anomaly reading: {result}")

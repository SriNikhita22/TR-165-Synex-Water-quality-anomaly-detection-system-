import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix

# 1. Hybrid Classification System
# Rule-based logic (Primary) + ML Classifier (Secondary)

def classify_contamination_rules(reading):
    """
    Rule-based classification of water contamination.
    """
    ph = reading.get('ph', 7.2)
    turbidity = reading.get('turbidity', 2.5)
    tds = reading.get('tds', 150)
    chlorine = reading.get('chlorine', 0.6)
    
    # Thresholds
    PH_MIN, PH_MAX = 6.5, 8.5
    TURBIDITY_NORMAL = 5.0
    CHLORINE_MIN = 0.2
    TDS_NORMAL = 300
    
    # Scoring for confidence
    scores = {"chemical": 0, "biological": 0, "physical": 0}
    
    # Chemical rules
    if ph < PH_MIN or ph > PH_MAX:
        scores["chemical"] += abs(ph - 7.5) * 2
    if tds > TDS_NORMAL:
        scores["chemical"] += (tds - TDS_NORMAL) / 100
        
    # Biological rules
    if chlorine < CHLORINE_MIN:
        scores["biological"] += (CHLORINE_MIN - chlorine) * 10
    if turbidity > TURBIDITY_NORMAL and turbidity < 10:
        scores["biological"] += (turbidity - TURBIDITY_NORMAL) / 2
        
    # Physical rules
    if turbidity >= 10:
        scores["physical"] += (turbidity - 10) / 2
        
    # Determine dominant type
    max_type = max(scores, key=scores.get)
    max_score = scores[max_type]
    
    if max_score == 0:
        return {"type": "unknown", "confidence": 0.0}
    
    # Normalize confidence (0-1)
    confidence = min(1.0, max_score / 5.0)
    
    return {"type": max_type, "confidence": round(confidence, 2)}

class ContaminationClassifierML:
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.is_trained = False
        
    def train(self, df):
        print("Training ML Classifier...")
        features = ['ph', 'turbidity', 'tds', 'chlorine']
        # Filter only anomalies for classification training
        anomaly_df = df[df['anomaly_label'] == 1].copy()
        
        if len(anomaly_df) < 10:
            print("Not enough anomaly data to train ML classifier.")
            return
            
        X = anomaly_df[features]
        y = anomaly_df['anomaly_type']
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        self.model.fit(X_train, y_train)
        self.is_trained = True
        
        # Evaluation
        y_pred = self.model.predict(X_test)
        print("\nML Classification Report:")
        print(classification_report(y_test, y_pred))
        
    def predict(self, reading):
        if not self.is_trained:
            return None
        
        features = ['ph', 'turbidity', 'tds', 'chlorine']
        X = pd.DataFrame([reading])[features]
        pred_type = self.model.predict(X)[0]
        probs = self.model.predict_proba(X)[0]
        confidence = np.max(probs)
        
        return {"type": pred_type, "confidence": round(confidence, 2)}

def visualize_classification(df):
    """
    Visualizes the distribution and patterns of contamination types.
    """
    anomaly_df = df[df['anomaly_label'] == 1].copy()
    if anomaly_df.empty:
        print("No anomaly data to visualize.")
        return

    plt.figure(figsize=(15, 10))
    
    # 1. Distribution of contamination types
    plt.subplot(2, 2, 1)
    sns.countplot(data=anomaly_df, x='anomaly_type', palette='viridis')
    plt.title('Distribution of Contamination Types')
    
    # 2. Feature patterns: pH vs Turbidity
    plt.subplot(2, 2, 2)
    sns.scatterplot(data=anomaly_df, x='ph', y='turbidity', hue='anomaly_type', style='anomaly_type', s=100)
    plt.title('pH vs Turbidity by Contamination Type')
    
    # 3. Feature patterns: Chlorine vs TDS
    plt.subplot(2, 2, 3)
    sns.scatterplot(data=anomaly_df, x='chlorine', y='tds', hue='anomaly_type', style='anomaly_type', s=100)
    plt.title('Chlorine vs TDS by Contamination Type')
    
    # 4. Boxplot of features
    plt.subplot(2, 2, 4)
    melted_df = anomaly_df.melt(id_vars=['anomaly_type'], value_vars=['ph', 'turbidity', 'chlorine'], var_name='Feature', value_name='Value')
    sns.boxplot(data=melted_df, x='Feature', y='Value', hue='anomaly_type')
    plt.title('Feature Ranges by Contamination Type')
    
    plt.tight_layout()
    plt.savefig('contamination_classification_viz.png')
    print("Classification visualization saved to contamination_classification_viz.png")

if __name__ == "__main__":
    from generate_dataset import generate_water_quality_dataset
    
    # Generate data
    print("Generating dataset...")
    df = generate_water_quality_dataset(hours=48)
    
    # Rule-based test
    print("\n--- Rule-based Classification Test ---")
    test_readings = [
        {'ph': 5.5, 'turbidity': 3.0, 'tds': 150, 'chlorine': 0.6}, # Chemical (Low pH)
        {'ph': 7.2, 'turbidity': 6.5, 'tds': 150, 'chlorine': 0.05}, # Biological (Low chlorine)
        {'ph': 7.2, 'turbidity': 25.0, 'tds': 150, 'chlorine': 0.6}, # Physical (High turbidity)
    ]
    
    for r in test_readings:
        print(f"Reading: {r} -> Result: {classify_contamination_rules(r)}")
        
    # ML Classifier test
    ml_classifier = ContaminationClassifierML()
    ml_classifier.train(df)
    
    if ml_classifier.is_trained:
        print("\n--- ML-based Classification Test ---")
        for r in test_readings:
            print(f"Reading: {r} -> Result: {ml_classifier.predict(r)}")
            
    # Visualization
    visualize_classification(df)

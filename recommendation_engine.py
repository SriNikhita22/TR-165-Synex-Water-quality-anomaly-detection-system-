import json

def generate_recommendation(data):
    """
    Generates actionable recommendations based on water contamination data.
    
    Input data format:
    {
        "contamination_type": "chemical | biological | physical | unknown",
        "severity": "LOW | MEDIUM | HIGH | CRITICAL",
        "metrics": {"ph": 7.2, "turbidity": 2.5, "tds": 150, "chlorine": 0.6},
        "radius": 500
    }
    """
    ctype = data.get('contamination_type', 'unknown').lower()
    severity = data.get('severity', 'LOW').upper()
    metrics = data.get('metrics', {})
    radius = data.get('radius', 0)
    
    actions = []
    notes = ""
    priority = "LOW"
    est_time = "2-4 hours"
    
    # 1. Base actions by contamination type
    if ctype == 'chemical':
        actions = ["Flush pipelines", "Isolate affected zone", "Adjust pH levels"]
        notes = "Chemical imbalance detected. Potential industrial runoff or pipe corrosion."
    elif ctype == 'biological':
        actions = ["Increase chlorination", "Issue boil water advisory", "Inspect microbial sources"]
        notes = "Pathogen risk detected. Chlorine levels insufficient for disinfection."
    elif ctype == 'physical':
        actions = ["Activate filtration systems", "Check pipeline damage", "Remove suspended particles"]
        notes = "High suspended solids. Likely pipeline breach or construction interference."
    else:
        actions = ["Increase sampling frequency", "Verify sensor calibration", "Manual inspection"]
        notes = "Anomaly detected without clear signature. Precautionary check required."
        
    # 2. Adjust based on severity
    if severity == 'CRITICAL' or severity == 'HIGH':
        priority = "HIGH"
        est_time = "Immediate (< 30 mins)"
        actions.insert(0, "EMERGENCY SHUTDOWN of local grid")
        actions.append("Notify Health Authorities")
    elif severity == 'MEDIUM':
        priority = "MEDIUM"
        est_time = "1-2 hours"
        actions.insert(0, "Notify Grid Operators")
    else:
        priority = "LOW"
        est_time = "Next scheduled shift"
        actions = [f"Monitor {ctype} levels closely"]
        
    # 3. Confidence Score (Simulated)
    confidence = 0.85 if ctype != 'unknown' else 0.45
    
    return {
        "actions": actions,
        "priority": priority,
        "estimated_response_time": est_time,
        "notes": notes,
        "confidence": confidence
    }

if __name__ == "__main__":
    # Test cases
    test_data = [
        {
            "contamination_type": "biological",
            "severity": "CRITICAL",
            "metrics": {"ph": 7.2, "turbidity": 8.5, "tds": 150, "chlorine": 0.05},
            "radius": 1200
        },
        {
            "contamination_type": "chemical",
            "severity": "MEDIUM",
            "metrics": {"ph": 9.5, "turbidity": 2.5, "tds": 600, "chlorine": 0.6},
            "radius": 400
        }
    ]
    
    for d in test_data:
        rec = generate_recommendation(d)
        print(f"\nInput: {d['contamination_type']} ({d['severity']})")
        print(json.dumps(rec, indent=2))

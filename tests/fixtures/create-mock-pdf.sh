#!/bin/bash

# Create a simple text file that simulates PDF content
cat > tests/fixtures/test-rfp.txt << 'EOF'
REQUEST FOR PROPOSAL (RFP)
RFP No: TEST-2024-MED-001

PROCUREMENT OF MEDICAL EQUIPMENT

The Department of Veterans Affairs is seeking qualified vendors to provide
advanced medical imaging equipment including MRI machines, CT scanners,
and associated support services for multiple VA medical centers.

REQUIREMENTS:
1. FDA approved equipment only
2. Minimum 5-year warranty on all equipment
3. Installation and training services included
4. 24/7 technical support availability
5. HIPAA compliant data handling capabilities
6. Energy Star certified where applicable

EVALUATION CRITERIA:
• Technical Capability (40%)
• Past Performance (25%)
• Price (20%)
• Small Business Participation (15%)

SUBMISSION DEADLINE:
March 15, 2024 at 2:00 PM EST

TECHNICAL SPECIFICATIONS

MRI Scanner Requirements:
- 3.0 Tesla magnetic field strength minimum
- Advanced cardiac imaging capabilities
- Pediatric imaging protocols

CT Scanner Requirements:
- 64-slice minimum
- Dual-energy capability
- Dose reduction technology

Service Requirements:
- Response time: 4 hours for critical issues
- Preventive maintenance quarterly
- Remote diagnostics capability
EOF

# For testing purposes, we'll use the text file as a mock PDF
cp tests/fixtures/test-rfp.txt tests/fixtures/test-rfp.pdf

echo "Mock test PDF created at: tests/fixtures/test-rfp.pdf"
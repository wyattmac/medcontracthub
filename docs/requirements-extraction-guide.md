# Requirements Extraction Tool Guide

## Overview

The Requirements Extraction Tool is a Playwright-based automation script that navigates through MedContractHub opportunities to extract key requirements from RFQ and contract documents. It uses advanced pattern matching to identify and categorize requirements automatically.

## Features

- **Automated Navigation**: Logs into MedContractHub and navigates to opportunities
- **Document Processing**: Opens and extracts text from RFQ/contract documents
- **Smart Extraction**: Uses regex patterns to identify 7 categories of requirements:
  - Deliverables and milestones
  - Technical specifications
  - Compliance/regulatory requirements
  - Timeline and deadlines
  - Budget constraints
  - Performance criteria
  - Special terms or conditions
- **Multiple Output Formats**: Saves results as JSON and CSV
- **Batch Processing**: Can process multiple opportunities in one run
- **Error Recovery**: Handles navigation errors gracefully
- **Daily Automation**: Can be scheduled to run automatically

## Installation

1. Ensure Playwright is installed:
```bash
npm install playwright @playwright/test
```

2. Install required dependencies:
```bash
npm install dotenv ts-node
```

## Usage

### Quick Start

Run the extraction tool:
```bash
./scripts/run-requirements-extraction.sh
```

### Run Modes

1. **Standalone Mode** (Default):
```bash
./scripts/run-requirements-extraction.sh standalone
```

2. **Test Mode** (Playwright Test Framework):
```bash
./scripts/run-requirements-extraction.sh test
```

### Configuration

Set environment variables in `.env.local`:
```env
# Application URL
BASE_URL=http://localhost:3000

# Credentials
EXTRACT_EMAIL=your-email@medcontracthub.com
EXTRACT_PASSWORD=your-password

# Output settings
OUTPUT_DIR=./extracted-requirements
HEADLESS=true
MAX_OPPORTUNITIES=50
```

### Command Options

```bash
# Run extraction
./scripts/run-requirements-extraction.sh

# Schedule daily runs (2 AM)
./scripts/run-requirements-extraction.sh standalone schedule

# View recent results
./scripts/run-requirements-extraction.sh standalone view

# Clean old results (>30 days)
./scripts/run-requirements-extraction.sh standalone clean

# Show help
./scripts/run-requirements-extraction.sh standalone help
```

## Output Format

### JSON Output
```json
{
  "opportunityId": "SPE300-24-R-0001",
  "opportunityName": "Medical Equipment Maintenance Services",
  "documentType": "RFQ",
  "documentName": "RFQ-Medical-Equipment.pdf",
  "documentUrl": "https://medcontracthub.com/documents/123",
  "extractedDate": "2024-01-15T10:30:00.000Z",
  "requirements": {
    "deliverables": [
      "Monthly maintenance reports for all equipment",
      "24/7 emergency response capability"
    ],
    "technicalSpecs": [
      "ISO 13485 certified technicians required",
      "Experience with GE and Siemens medical imaging equipment"
    ],
    "compliance": [
      "FAR 52.222-50 Combating Trafficking in Persons",
      "HIPAA compliance required for all personnel"
    ],
    "timeline": [
      "Contract Period: 01/01/2024 - 12/31/2024",
      "Response time: 4 hours for critical equipment"
    ],
    "budget": [
      "Not to exceed $500,000 annually"
    ],
    "performance": [
      "99.5% uptime for critical equipment",
      "Customer satisfaction rating >4.5/5.0"
    ],
    "specialTerms": [
      "Contractor must maintain spare parts inventory on-site"
    ]
  },
  "metadata": {
    "processingTime": 3456,
    "textLength": 15234,
    "extractionMethod": "pattern-matching"
  }
}
```

### CSV Output
The CSV format includes:
- Opportunity details
- Document information
- Requirement counts by category
- Sample requirements for quick review

## Extraction Patterns

The tool uses sophisticated regex patterns to identify requirements:

### Deliverables
- "Deliverable:", "Milestone:", "Work Products:"
- Numbered lists with deliverable keywords

### Technical Specifications
- "Technical Requirements:", "Specifications:"
- Equipment requirements and standards

### Compliance
- FAR/DFARS citations
- "Compliance Requirements:", "Regulatory Requirements:"
- Certification requirements

### Timeline
- Date patterns (MM/DD/YYYY)
- "Timeline:", "Deadline:", "Period of Performance:"

### Budget
- Dollar amounts with context
- "Budget:", "Not to exceed:", "Estimated cost:"

### Performance
- "Performance Criteria:", "Acceptance Criteria:"
- KPIs and quality standards

### Special Terms
- "Special Terms:", "Additional Requirements:"
- Notes and conditions

## Daily Automation

To run the extraction daily:

```bash
# Set up cron job (runs at 2 AM)
./scripts/run-requirements-extraction.sh standalone schedule

# Verify cron job
crontab -l | grep requirements-extraction
```

## Troubleshooting

### Common Issues

1. **Login Fails**
   - Verify credentials in `.env.local`
   - Check if login selectors have changed
   - Try running with `HEADLESS=false` to debug

2. **No Documents Found**
   - Check document link selectors
   - Verify user has access to documents
   - Ensure documents are loaded before extraction

3. **Low Extraction Rate**
   - Review document format (PDF vs HTML)
   - Check if OCR processing is needed
   - Verify extraction patterns match document format

4. **Navigation Errors**
   - Update selectors if UI has changed
   - Increase wait times for slow networks
   - Check for session timeouts

### Debug Mode

Run with visible browser for debugging:
```bash
HEADLESS=false ./scripts/run-requirements-extraction.sh
```

### View Logs

Check extraction logs:
```bash
# View latest log
cat extracted-requirements/summary-*.txt | tail -20

# View cron logs
cat extracted-requirements/cron.log
```

## Integration with MedContractHub

The extracted requirements can be:
1. Imported into the proposal generation workflow
2. Used for compliance checking
3. Analyzed for common patterns
4. Fed into the AI service for proposal drafting

### API Integration Example
```typescript
// Import extracted requirements
import extractedReqs from './extracted-requirements/requirements-latest.json';

// Use in proposal generation
const proposal = await generateProposal({
  opportunityId: extractedReqs[0].opportunityId,
  requirements: extractedReqs[0].requirements,
  templateType: 'federal-contract'
});
```

## Performance Tips

1. **Batch Processing**: Process opportunities in batches to avoid timeouts
2. **Caching**: Reuse login sessions when possible
3. **Parallel Processing**: Consider running multiple instances for different date ranges
4. **Storage**: Clean old extractions regularly to save space

## Security Considerations

- Store credentials securely (use environment variables)
- Limit extraction to authorized opportunities only
- Sanitize extracted data before storage
- Monitor for unusual access patterns

## Support

For issues or enhancements:
1. Check the troubleshooting section
2. Review logs in the output directory
3. Contact the MedContractHub platform team
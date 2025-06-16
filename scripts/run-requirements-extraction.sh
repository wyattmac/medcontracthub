#!/bin/bash

# Requirements Extraction Script Runner
# This script runs the Playwright requirements extraction tool

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔍 MedContractHub Requirements Extraction Tool"
echo "============================================="

# Check if node_modules exists
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
    echo "❌ Error: node_modules not found. Please run 'npm install' first."
    exit 1
fi

# Create output directory if it doesn't exist
OUTPUT_DIR="${OUTPUT_DIR:-$PROJECT_ROOT/extracted-requirements}"
mkdir -p "$OUTPUT_DIR"

# Parse command line arguments
HEADLESS="${HEADLESS:-true}"
MAX_OPPORTUNITIES="${MAX_OPPORTUNITIES:-50}"
RUN_MODE="${1:-standalone}"

# Display configuration
echo ""
echo "Configuration:"
echo "  Output Directory: $OUTPUT_DIR"
echo "  Headless Mode: $HEADLESS"
echo "  Max Opportunities: $MAX_OPPORTUNITIES"
echo "  Run Mode: $RUN_MODE"
echo ""

# Function to run the extraction
run_extraction() {
    echo "🚀 Starting requirements extraction..."
    echo ""
    
    if [ "$RUN_MODE" = "test" ]; then
        # Run as Playwright test
        echo "Running in test mode..."
        cd "$PROJECT_ROOT"
        npx playwright test tests/e2e/extract-requirements.spec.ts \
            --project=chromium \
            --reporter=list
    else
        # Run as standalone script
        echo "Running in standalone mode..."
        cd "$PROJECT_ROOT"
        HEADLESS=$HEADLESS \
        MAX_OPPORTUNITIES=$MAX_OPPORTUNITIES \
        OUTPUT_DIR=$OUTPUT_DIR \
        npx ts-node scripts/extract-requirements.ts
    fi
}

# Function to schedule daily runs
setup_cron() {
    echo "📅 Setting up daily extraction schedule..."
    
    # Create cron job (runs daily at 2 AM)
    CRON_CMD="0 2 * * * cd $PROJECT_ROOT && $SCRIPT_DIR/run-requirements-extraction.sh > $OUTPUT_DIR/cron.log 2>&1"
    
    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "run-requirements-extraction.sh"; then
        echo "  ✓ Cron job already exists"
    else
        # Add to crontab
        (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
        echo "  ✓ Cron job added successfully"
        echo "  Scheduled to run daily at 2:00 AM"
    fi
}

# Function to view recent results
view_results() {
    echo "📊 Recent extraction results:"
    echo ""
    
    if [ -d "$OUTPUT_DIR" ]; then
        # Find most recent JSON file
        LATEST_JSON=$(ls -t "$OUTPUT_DIR"/requirements-*.json 2>/dev/null | head -n 1)
        
        if [ -n "$LATEST_JSON" ]; then
            echo "Latest extraction: $LATEST_JSON"
            echo ""
            
            # Show summary if jq is available
            if command -v jq &> /dev/null; then
                echo "Summary:"
                jq -r '
                    "Total Documents: \(length)",
                    "Document Types: \([.[].documentType] | group_by(.) | map({(.[0]): length}) | add)",
                    "Total Requirements: \([.[].requirements | to_entries | .[].value | length] | add)"
                ' "$LATEST_JSON"
            else
                echo "Install 'jq' to see detailed summary"
            fi
        else
            echo "No extraction results found"
        fi
    else
        echo "Output directory not found"
    fi
}

# Main menu
case "${2:-run}" in
    "schedule")
        setup_cron
        ;;
    "view")
        view_results
        ;;
    "clean")
        echo "🧹 Cleaning old extraction results..."
        find "$OUTPUT_DIR" -name "*.json" -mtime +30 -delete
        find "$OUTPUT_DIR" -name "*.csv" -mtime +30 -delete
        echo "  ✓ Removed files older than 30 days"
        ;;
    "help")
        echo "Usage: $0 [mode] [action]"
        echo ""
        echo "Modes:"
        echo "  standalone  - Run as standalone script (default)"
        echo "  test        - Run as Playwright test"
        echo ""
        echo "Actions:"
        echo "  run         - Run extraction (default)"
        echo "  schedule    - Set up daily cron job"
        echo "  view        - View recent results"
        echo "  clean       - Clean old results"
        echo "  help        - Show this help"
        echo ""
        echo "Environment Variables:"
        echo "  BASE_URL          - Application URL (default: http://localhost:3000)"
        echo "  EXTRACT_EMAIL     - Login email"
        echo "  EXTRACT_PASSWORD  - Login password"
        echo "  OUTPUT_DIR        - Output directory (default: ./extracted-requirements)"
        echo "  HEADLESS          - Run in headless mode (default: true)"
        echo "  MAX_OPPORTUNITIES - Maximum opportunities to process (default: 50)"
        ;;
    *)
        run_extraction
        ;;
esac

echo ""
echo "✅ Done!"
#!/bin/bash

# Claude Code Terminal Helper
# This script helps bridge Claude Code with your terminal

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🤖 Claude Code Terminal Helper${NC}"
echo "=============================="
echo ""

# Function to run command and save output
run_and_save() {
    local cmd=$1
    local output_file="/tmp/claude-output.txt"
    
    echo -e "${YELLOW}Running: $cmd${NC}"
    eval $cmd | tee $output_file
    
    echo ""
    echo -e "${GREEN}✅ Output saved to: $output_file${NC}"
    echo "Claude can read this file to see the results!"
}

# Menu
while true; do
    echo ""
    echo "What would you like to do?"
    echo "1. Check Docker status"
    echo "2. Start development environment"
    echo "3. Start staging environment"
    echo "4. Start production environment"
    echo "5. Run custom command"
    echo "6. Exit"
    echo ""
    read -p "Choose (1-6): " choice
    
    case $choice in
        1)
            run_and_save "docker ps"
            ;;
        2)
            run_and_save "./docker-scripts.sh start dev"
            ;;
        3)
            run_and_save "./docker-scripts.sh start staging"
            ;;
        4)
            run_and_save "./docker-scripts.sh start prod"
            ;;
        5)
            read -p "Enter command: " custom_cmd
            run_and_save "$custom_cmd"
            ;;
        6)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo "Invalid choice"
            ;;
    esac
done
#!/bin/bash

FILE="auto.txt"

read -p "Enter your name: " USERNAME

echo "Syncing with remote safely..."

# SAFE SYNC
git stash push -m "auto-stash-before-run"
git pull origin main --rebase
git stash pop 2>/dev/null

MESSAGES=("update" "fix" "patch" "refactor" "optimize")

for i in {1..2}
do
  MSG=${MESSAGES[$RANDOM % ${#MESSAGES[@]}]}

  echo "[$USERNAME] entry $i - $(date +%H:%M:%S)" >> $FILE

  git add $FILE
  git commit -m "$MSG by $USERNAME #$i"

  sleep 5
done

git push origin main
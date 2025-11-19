#!/bin/bash
API_KEY="7332bc56-e2769fd4-9f1a00b6-ebb7ce28"
WORKSPACE_ID="678eb62a071ff7544034bcde"
BASE_URL="https://api.plusvibe.ai/api/v1"

echo "Testing VibePlus API..."
echo "Endpoint: $BASE_URL/campaign/list-all"

curl -v -X GET "$BASE_URL/campaign/list-all?workspace_id=$WORKSPACE_ID&limit=5" \
  -H "x-api-key: $API_KEY" \
  -H "x-workspace-id: $WORKSPACE_ID" \
  -H "Content-Type: application/json"

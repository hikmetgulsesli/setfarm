## Browser Verification (optional when a dev server is running)

After writing code, verify changes visually and functionally:

1. If the dev server is running, use the browser tool:
   ```bash
   export AGENT_BROWSER_SESSION="{{current_story_id}}-impl"
   export AGENT_BROWSER_CONTENT_BOUNDARIES=1
   agent-browser open http://localhost:$(cat .dev-port 2>/dev/null || echo 3000)
   agent-browser wait --load networkidle
   agent-browser snapshot -i
   ```
2. Check that all buttons have handlers and all links route correctly.
3. Take screenshots for changed screens when possible.
4. If issues are found, fix and re-verify.
5. Always close: `agent-browser close`.

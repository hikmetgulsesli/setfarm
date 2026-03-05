Create story branch from feature branch:
cd {{repo}} && git checkout {{branch}} && git pull origin {{branch}}
RUN_SHORT=$(echo "{{run_id}}" | cut -c1-8)
STORY_BRANCH="${RUN_SHORT}-{{current_story_id}}"
git checkout -b "$STORY_BRANCH"

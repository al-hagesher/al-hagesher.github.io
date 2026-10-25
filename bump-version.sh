#!/bin/bash
# מעדכן את מספר הגרסה בקישורי הקבצים כדי שכל המכשירים יטענו את העדכון מיד
cd "$(dirname "$0")"
V=$(date +%Y%m%d%H%M)
sed -i '' -E "s/(src=\"js\/[^\"?]+\.js)(\?v=[0-9]+)?\"/\1?v=$V\"/g; s/(href=\"css\/style\.css)(\?v=[0-9]+)?\"/\1?v=$V\"/g" index.html
sed -i '' -E "s/al-hagesher-v[0-9]+/al-hagesher-$V/" sw.js
echo "גרסה $V"

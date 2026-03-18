#!/bin/bash
uvicorn server:app --host 0.0.0.0 --port $PORT
```

Без слова `web:` в начале — это не Procfile, это просто скрипт.

Также в Railway → Settings → **Start Command** очисти поле если там что-то написано — оставь пустым, пусть Railway сам запустит `start.sh`.

Или проще — в Railway → Settings → **Start Command** напиши напрямую:
```
uvicorn server:app --host 0.0.0.0 --port $PORT

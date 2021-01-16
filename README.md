# Board

A real-time collaborative scrum board.

![](screenshot.png)

## Usage

First-time usage:

```
echo BOARD_PORT=3000 > .env
echo BOARD_DB=./db >> .env
docker-compose up
```

Rebuild after update, e.g., via `git pull`:

```
docker-compose up --build
```

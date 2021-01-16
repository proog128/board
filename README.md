# Board

A real-time collaborative scrum board.

![](screenshot.png)

## Usage

```
echo BOARD_PORT=3000 > .env
echo BOARD_DB=./db >> .env
docker build -t board .
docker-compose up
```

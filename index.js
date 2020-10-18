const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const playground = require('./playground');

app.get('/api/:board', (req, res) => {
    res.send(playground.board);
});

app.use('/:board', express.static(path.join(__dirname, 'public')));
app.use('/', (req, res) => {
    res.redirect('/default');
});

io.on('connect', (socket) => {
    const boardName = socket.handshake.query.board;
    socket.join(boardName);

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
    socket.on('additem', (item, cell, sibling) => {
        io.in(boardName).emit('additem', item, cell, sibling);
    });
    socket.on('updateitemcontent', (item, content) => {
        io.in(boardName).emit('updateitemcontent', item, content);
    });
    socket.on('updateitemcolor', (item, color) => {
        io.in(boardName).emit('updateitemcolor', item, color);
    });
    socket.on('deleteitem', (item) => {
        io.in(boardName).emit('deleteitem', item);
    });
    socket.on('moveitem', (item, cell, sibling) => {
        io.in(boardName).emit('moveitem', item, cell, sibling);
    });
    socket.on('addrow', (row, cells, header, sibling) => {
        io.in(boardName).emit('addrow', row, cells, header, sibling);
    });
    socket.on('moverow', (row, sibling) => {
        io.in(boardName).emit('moverow', row, sibling);
    });
    socket.on('deleterow', (row) => {
        io.in(boardName).emit('deleterow', row);
    });
});

http.listen(3000, () => {
    console.log('listening on *:3000');
});

const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const demoBoard = require('./demoBoard');
const emptyBoard = require('./emptyBoard');
const MongoClient = require('mongodb').MongoClient;

const mongoUri = 'mongodb://root:example@localhost:27017/?poolSize=20&w=majority';
const mongo = new MongoClient(mongoUri);

let boards = null;

function createEmptyBoard(boardName) {
    board = { ...emptyBoard.board };
    board['name'] = boardName;
    board['displayName'] = boardName;
    return board;
}

async function addRow(boardName, rowId, cellIds, headerId, siblingId) {
    let board = await boards.findOne(
        { name: boardName });
    if (board == null) {
        board = createEmptyBoard(boardName);
        const result = boards.insertOne(board);
        if (result.insertedCount == 0) {
            throw(`Failed to create empty board ${boardName}.`);
        }
    }
    let pos = board.rows.length;
    if (siblingId) {
        pos = board.rows.findIndex(e => e.id == siblingId);
    }
    let row = {
        id: rowId,
        cells: cellIds.map(cellId => {
            return {
                id: cellId,
                items: []
            };
        })
    };
    row.cells[0].items.push({ id: headerId, classList: ['large', 'green'] });
    const result = await boards.updateOne(
        { name: boardName },
        { $push: {
            rows: {
                $each: [ row ],
                $position: pos
            }
        }
    });
    if (result.modifiedCount == 0) {
        throw(`Failed to insert row ${rowId} at index ${pos} into ${boardName}.`);
    }
}

app.get('/api/demo/reset', async (req, res) => {
    try {
        const result = await boards.replaceOne({ name: 'demo' }, demoBoard.board, { upsert: true });
        if (result.modifiedCount > 0 || result.upsertCount > 0) {
            res.send('OK');
        } else {
            res.send('ERR');
        }
    } catch(err) {
        res.send('ERR: ' + err, 500);
    }
});
app.get('/api/:board', async (req, res) => {
    try {
        let board = await boards.findOne({ name: req.params.board });
        if (board == null) {
            board = createEmptyBoard(req.params.board);
        }
        res.send(board);
    } catch(err) {
        res.send('ERR: ' + err, 500);
    }
});

app.use('/:board', express.static(path.join(__dirname, 'public')));
app.use('/', (req, res) => {
    res.redirect('/demo');
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
    socket.on('addrow', async (rowId, cellIds, headerId, siblingId) => {
        try {
            await addRow(boardName, rowId, cellIds, headerId, siblingId);
            io.in(boardName).emit('addrow', rowId, cellIds, headerId, siblingId);
        } catch(err) {
            socket.emit('errormsg', err);
            socket.emit('deleterow', rowId);
        }
    });
    socket.on('moverow', (row, sibling) => {
        io.in(boardName).emit('moverow', row, sibling);
    });
    socket.on('deleterow', (row) => {
        io.in(boardName).emit('deleterow', row);
    });
});

async function run() {
    try {
        await mongo.connect();
        await mongo.db('boards').command({ ping: 1});
        const db = mongo.db('board');
        boards = db.collection('boards');
        
        http.listen(3000, () => {
            console.log('listening on *:3000');
        });    
    } catch(err) {
        console.log(err);
        mongo.close();
    }    
}

run().catch(console.dir);

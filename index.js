const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const demoBoard = require('./demoBoard');
const aggregations = require('./aggregations');
const MongoClient = require('mongodb').MongoClient;

const PORT = process.env.BOARD_PORT || 3000;
const DB = process.env.BOARD_DB || 'mongodb://root:example@localhost:27017/?poolSize=20&w=majority';

const mongo = new MongoClient(DB);

let boards = null;

async function createBoard(boardName, title, columns) {
    const board = {
        name: boardName,
        title: title,
        columns: [''].concat(columns),
        rows: []
    };
    try {
        await boards.insertOne(board);
    } catch (err) {
        console.log(`Failed to create board ${boardName}. ${err.message}.`);
        return false;
    }
    return true;
}

async function deleteBoard(boardName) {
    try {
        await boards.remove({ name: boardName });
    } catch (err) {
        console.log(`Failed to delete board ${boardName}. ${err.message}.`);
        return false;
    }
    return true;
}

async function addItem(boardName, itemId, cellId, siblingId) {
    const item = {
        id: itemId,
        content: ''
    };
    const result = await boards.updateOne(
        { name: boardName },
        aggregations.addItem(item, cellId, siblingId)
    );
    if (result.modifiedCount == 0) {
        console.log(`Failed to insert item ${itemId} before ${siblingId} into cell ${cellId} in ${boardName}.`);
        return false;
    }
    return true;
}

async function moveItem(boardName, itemId, cellId, siblingId) {
    const result = await boards.updateOne(
        { name: boardName },
        aggregations.moveItem(itemId, cellId, siblingId)
    );
    if (result.modifiedCount == 0) {
        console.log(`Failed to move item ${itemId} before ${siblingId} into cell ${cellId} in ${boardName}.`);
        return false;
    }
    return true;
}

async function deleteItem(boardName, itemId) {
    const result = await boards.updateOne(
        { name: boardName },
        aggregations.deleteItem(itemId)
    );
    if (result.modifiedCount == 0) {
        console.log(`Failed to delete item ${itemId} in ${boardName}.`);
        return false;
    } 
    return true;
}

async function getItemPos(boardName, itemId) {
    const result = await boards.findOne(
        { name: boardName },
        { projection: aggregations.getItemPos(itemId)});
    if (result.length == 0) {
        console.log(`Failed to retrieve item ${itemId} in ${boardName}.`);
        return null;
    }
    return result.result[0];
}

async function updateItem(boardName, itemId, data) {
    const result = await boards.updateOne(
        { name: boardName },
        aggregations.updateItem(itemId, data)
    );
    if (result.modifiedCount == 0) {
        console.log(`Failed to update item ${itemId} in ${boardName}. Maybe the item did not change?`);
        return false;
    }
    return true;
}

async function getItem(boardName, itemId) {
    const result = await boards.findOne(
        { name: boardName },
        { projection: aggregations.getItem(itemId)});
    if (result.length == 0) {
        console.log(`Failed to retrieve item ${itemId} in ${boardName}.`);
        return null;
    }
    return result.result[0];
}

async function addRow(boardName, rowId, cellIds, headerId, siblingId) {
    let row = {
        id: rowId,
        cells: cellIds.map(cellId => {
            return {
                id: cellId,
                items: []
            };
        })
    };
    row.cells[0].items.push({ id: headerId, type: 'large', color: 'green' });

    const result = await boards.updateOne(
        { name: boardName },
        aggregations.addRow(row, siblingId)
    );
    if (result.modifiedCount == 0) {
        console.log(`Failed to insert row ${rowId} before ${siblingId} into ${boardName}.`);
        return false;
    }
    return true;
}

async function moveRow(boardName, rowId, siblingId) {
    const result = await boards.updateOne(
        { name: boardName },
        aggregations.moveRow(rowId, siblingId)
    );
    if (result.modifiedCount == 0) {
        console.log(`Failed to move row ${rowId} to ${siblingId} in board ${boardName}.`);
        return false;
    }
    return true;
}

async function deleteRow(boardName, rowId) {
    const result = await boards.updateOne(
        { name: boardName },
        { $pull: {
            rows: {
                id: rowId
            }
        }}
    );
    if (result.modifiedCount == 0) {
        console.log(`Failed to delete row ${rowId} of ${boardName}.`);
        return false;
    }
    return true;
}

async function getRowPos(boardName, rowId) {
    const result = await boards.findOne(
        { name: boardName },
        { projection: aggregations.getRowPos(rowId)});
    if (result.length == 0) {
        console.log(`Failed to retrieve row ${rowId} in ${boardName}.`);
        return null;
    }
    return result.result[0];
}

async function updateTitle(boardName, title) {
    const result = await boards.updateOne(
        { name: boardName },
        { $set: { title: title }});
    if (result.modifiedCount == 0) {
        console.log(`Failed to update title of board ${boardName}. Maybe the title did not change?`);
        return false;
    }
    return true;
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
            res.send({})
        } else {
            res.send(board);
        }
    } catch(err) {
        res.send('ERR: ' + err, 500);
    }
});

app.use('/style.css', express.static(path.join(__dirname, 'public', 'style.css')));
app.use('/script.js', express.static(path.join(__dirname, 'public', 'script.js')));
app.use('/favicon.ico', express.static(path.join(__dirname, 'public', 'favicon.ico')));
app.use('/:board', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use('/', (req, res) => {
    res.redirect('/demo');
});

io.on('connect', (socket) => {
    const boardName = socket.handshake.query.board;
    socket.join(boardName);

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
    socket.on('additem', async (itemId, cellId, siblingId) => {
        await addItem(boardName, itemId, cellId, siblingId);
        const pos = await getItemPos(boardName, itemId);
        if (pos) {
            io.in(boardName).emit('additem', itemId, pos.cellId, pos.siblingId);
        } else {
            io.in(boardName).emit('deleteitem', itemId);
        }
    });
    socket.on('updateitemcontent', async (itemId, content) => {
        await updateItem(boardName, itemId, { content: content });
        const item = await getItem(boardName, itemId);
        if (item) {
            io.in(boardName).emit('updateitemcontent', itemId, item.content);
        } else {
            io.in(boardName).emit('deleteitem', itemId);
        }
    });
    socket.on('updateitemcolor', async (itemId, color) => {
        await updateItem(boardName, itemId, { color: color });
        const item = await getItem(boardName, itemId);
        if (item) {
            io.in(boardName).emit('updateitemcolor', itemId, item.color);
        } else {
            io.in(boardName).emit('deleteitem', itemId);
        }

    });
    socket.on('deleteitem', async (itemId) => {
        await deleteItem(boardName, itemId);
        io.in(boardName).emit('deleteitem', itemId);
    });
    socket.on('moveitem', async (itemId, cellId, siblingId) => {
        await moveItem(boardName, itemId, cellId, siblingId);
        const pos = await getItemPos(boardName, itemId);
        if (pos) {
            io.in(boardName).emit('moveitem', itemId, pos.cellId, pos.siblingId);
        } else {
            io.in(boardName).emit('deleteitem', itemId);
        }
    });
    socket.on('addrow', async (rowId, cellIds, headerId, siblingId) => {
        await addRow(boardName, rowId, cellIds, headerId, siblingId);
        const pos = await getRowPos(boardName, rowId);
        if (pos) {
            io.in(boardName).emit('addrow', rowId, cellIds, headerId, pos.siblingId);
        } else {
            io.in(boardName).emit('deleterow', rowId);
        }            
    });
    socket.on('moverow', async (rowId, siblingId) => {
        await moveRow(boardName, rowId, siblingId);
        const pos = await getRowPos(boardName, rowId);
        if (pos) {
            io.in(boardName).emit('moverow', rowId, pos.siblingId);
        } else {
            io.in(boardName).emit('deleterow', rowId);
        }
    });
    socket.on('deleterow', async (rowId) => {
        await deleteRow(boardName, rowId);
        io.in(boardName).emit('deleterow', rowId);
    });
    socket.on('updatetitle', async (title) => {
        await updateTitle(boardName, title);
        io.in(boardName).emit('updatetitle', title);
    });
    socket.on('createboard', async (title, columns, ack) => {
        const success = await createBoard(boardName, title, columns);
        ack(success);
    });
    socket.on('deleteboard', async (ack) => {
        const success = await deleteBoard(boardName);
        ack(success);
    });
});

async function run() {
    try {
        await mongo.connect();
        await mongo.db('boards').command({ ping: 1});
        const db = mongo.db('board');
        boards = db.collection('boards');

        try {
            await boards.insertOne(demoBoard.board, { forceServerObjectId: true });
        } catch {}

        await boards.createIndex('name', { unique: true });

        http.listen(PORT, () => {
            console.log(`listening on *:${PORT}`);
        });    
    } catch(err) {
        console.log(err);
        mongo.close();
    }    
}

run().catch(console.dir);

let numColumns = 0;
const boardName = window.location.pathname.split('/').filter(s => s)[0];

// Create element from HTML template.
function create(templateId) {
    const c = document.getElementById(templateId).content;
    return c.cloneNode(true).children[0];
};

// Initialize drag and drop for all items in a row.
function initDrag(row) {
    const cells = row.querySelectorAll('.cell');
    const cellsArray = Array.prototype.slice.call(cells);
    const drake = dragula(cellsArray, {
        direction: 'horizontal',
        invalid: (el, handle) => {
            return !(el.classList.contains('item') || el.classList.contains('textarea'));
        },
        accepts: (el, target, source, sibling) => {
            if (source.parentNode != target.parentNode) {
                return false;
            }
            const isHeaderItem = el.classList.contains('large');
            const isHeaderCell = target.classList.contains('row-header');
            if (isHeaderCell && !isHeaderItem) {
                return false;
            }
            return true;
        }
    });
    drake.on('drop', (element, target, source, sibling) => {
        emitMoveItem(element, target, sibling);
    });
};

// Add an item before sibling to a cell. If id is null, a random
// id is generated. If sibling is null, the item is appended to the end.
function addItem(cell, id, sibling, classList, content) {
    const item = create('titem');
    if (classList) {
        classList.forEach(c => {
            item.classList.add(c);
        });
    }
    item.id = id ?? uuidv4();
    item.querySelector('.textarea').innerText = content ?? '';
    cell.insertBefore(item, sibling);
    return item;
};

// Updates the text content of an item.
function updateItemContent(item, content) {
    item.querySelector('.textarea').innerText = content;
}

// Change color of an item to color. Colors correspond to CSS classes
// 'red', 'green' and 'blue'
function changeColor(item, color) {
    item.classList.remove('red');
    item.classList.remove('green');
    item.classList.remove('blue');
    item.classList.add(color);
};

// Delete item from cell.
function deleteItem(item) {
    item.remove();
};

// Move item from current position to the position
// before sibling in cell with an animation.
function moveItem(item, cell, sibling) {
    const oldX = item.getBoundingClientRect().x;
    const oldY = item.getBoundingClientRect().y;
    cell.insertBefore(item, sibling);
    const newX = item.getBoundingClientRect().x;
    const newY = item.getBoundingClientRect().y;
    const dx = oldX - newX;
    const dy = oldY - newY;
    item.animate([
        { transform: 'translate(' + dx + 'px,' + dy + 'px)' },
        { transform: 'translate(0px, 0px)' }
    ], {
        duration: 200,
        easing: 'ease-in'
    });
}

// Add a row before sibling to the table. Automatically creates all cells
// If id or cellIds is null, random ids are generated. If sibling
// is null, the row is appended to the end.
function addRow(id, cellIds, sibling) {
    const row = create('trow');
    let newCells = [];
    row.id = id ?? uuidv4();
    for (let i=0; i<numColumns; ++i) {
        const cell = create('tcell');
        if (i == 0) {
            cell.classList.add('row-header');
        }
        if (cellIds) {
            cell.id = cellIds[i];
        } else {
            cell.id = uuidv4();
        }

        newCells.push(cell);
        row.appendChild(cell);
    }
    initDrag(row);

    const table = document.querySelector('.table');
    table.insertBefore(row, sibling);

    return [row, newCells];
}

// Move row from current position to the position before
// sibling with an animation.
function moveRow(row, sibling) {
    const table = document.querySelector('.table');
    const oldX = row.getBoundingClientRect().x;
    const oldY = row.getBoundingClientRect().y;
    table.insertBefore(row, sibling);
    const newX = row.getBoundingClientRect().x;
    const newY = row.getBoundingClientRect().y;
    const dx = oldX - newX;
    const dy = oldY - newY;
    row.animate([
        { transform: 'translate(' + dx + 'px,' + dy + 'px)' },
        { transform: 'translate(0px, 0px)' }
    ], {
        duration: 200,
        easing: 'ease-in'
    });
}

// Delete row from table.
function deleteRow(row) {
    row.remove();
}

// Send message to server.

function emitAddItem(item, cell, sibling) {
    socket.emit('additem', item.id, cell.id, sibling?.id);
}

function emitUpdateItemContent(item, content) {
    socket.emit('updateitemcontent', item.id, content);
}

function emitUpdateItemColor(item, color) {
    socket.emit('updateitemcolor', item.id, color);
}

function emitDeleteItem(item) {
    socket.emit('deleteitem', item.id);
}

function emitMoveItem(item, cell, sibling) {
    socket.emit('moveitem', item.id, cell.id, sibling?.id);
}

function emitAddRow(row, cells, header, sibling) {
    socket.emit('addrow', row.id, cells, header, sibling?.id);
}

function emitDeleteRow(row) {
    socket.emit('deleterow', row.id);
}

function emitMoveRow(row, sibling) {
    socket.emit('moverow', row.id, sibling?.id);
}

// Receive messages from server.

const socket = io({
    'query': {
        'board': boardName
    }
});

socket.on('additem', (itemId, cellId, siblingId) => {
    const item = document.getElementById(itemId);
    const cell = document.getElementById(cellId);
    const sibling = document.getElementById(siblingId);
    if (item) {
        moveItem(item, cell, sibling);
    } else {
        addItem(cell, itemId, null, sibling);
    }
});

socket.on('updateitemcontent', (itemId, content) => {
    const item = document.getElementById(itemId);
    if (item) {
        updateItemContent(item, content);
    }
});

socket.on('updateitemcolor', (itemId, color) => {
    const item = document.getElementById(itemId);
    if (item) {
        changeColor(item, color);
    }
});

socket.on('deleteitem', (itemId) => {
    const item = document.getElementById(itemId);
    if (item) {
        deleteItem(item);
    }
});

socket.on('moveitem', (itemId, cellId, siblingId) => {
    const item = document.getElementById(itemId);
    const cell = document.getElementById(cellId);
    const sibling = document.getElementById(siblingId);
    moveItem(item, cell, sibling);
});

socket.on('addrow', (rowId, cellIds, headerItemId, siblingId) => {
    const row =  document.getElementById(rowId);
    const sibling = document.getElementById(siblingId);
    if (row) {
        moveRow(row, sibling);
    } else {
        const [row, cells] = addRow(rowId, cellIds, sibling);
        addItem(cells[0], headerItemId, null, 'large green');
    }
});

socket.on('moverow', (rowId, siblingId) => {
    const row = document.getElementById(rowId);
    const sibling = document.getElementById(siblingId);
    if (row) {
        moveRow(row, sibling);
    }
});

socket.on('deleterow', (rowId) => {
    const row = document.getElementById(rowId);
    if (row) {
        deleteRow(row);
    }
});

socket.on('errormsg', (message) => {
    console.log(`Error returned from server: ${message}`);
});

// Event handlers bound in HTML.

window.addRow = () => {
    const [row, cells] = addRow();
    const cellIds = cells.map((c) => c.id);
    const headerItem = addItem(cells[0], null, null, ['large', 'green']);
    row.querySelector('.textarea').focus();
    emitAddRow(row, cellIds, headerItem.id, row.nextElementSibling);
};
window.deleteRow = (el) => {
    const row = el.closest('.row');
    deleteRow(row);
    emitDeleteRow(row);
};
window.addItem = (el) => {
    const cell = el.closest('.cell');
    const item = addItem(cell);
    emitAddItem(item, cell, item.nextElementSibling);
    item.querySelector('.textarea').focus();
};
window.editFinished = (el) => {
    const item = el.closest('.item');
    const content = item.querySelector('.textarea').innerText;
    emitUpdateItemContent(item, content);
};
window.changeColor = (el, color) => {
    const item = el.closest('.item');
    changeColor(item, color);
    emitUpdateItemColor(item, color);
};
window.deleteItem = (el) => {
    const item = el.closest('.item');
    deleteItem(item);
    emitDeleteItem(item);
};

window.onload = async () => {
    const table = document.querySelector('.table');
    const tableDrake = dragula([table], {
        direction: 'vertical',
        invalid: (el, handle) => {
            return !handle.classList.contains('row');
        },
    });
    tableDrake.on('drop', (element, target, source, sibling) => {
        emitMoveRow(element, sibling);
    });
    
    const rows = document.querySelectorAll('.row');
    rows.forEach((row) => {
        initDrag(row);
    });

    const dataResponse = await fetch('/api/' + boardName);
    if (!dataResponse.ok) {
        console.log(dataResponse.status + ' ' + dataResponse.statusText);
        return;
    }
  
    const data = await dataResponse.json();
    numColumns = data.columns.length;
    
    for (const rowData of data.rows) {
        const rowId = rowData.id;
        const cellIds = rowData.cells.map((c) => c.id);
        const [newRow, cells] = addRow(rowId, cellIds);
        rowData.cells.forEach((cellData, i) => {
            cellData.items.forEach((itemData, j) => {
                const itemId = itemData.id;
                const sibling = itemData[i + 1]?.id;
                const classList = itemData.classList;
                const content = itemData.content;
                addItem(cells[i], itemId, sibling, classList, content);
            });
        });
    }
}

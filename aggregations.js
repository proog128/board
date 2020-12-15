function insertBefore(array, elementOrEmpty, siblingIndex) {
    return {
        $let: {
            vars: {
                "siblingIndex": siblingIndex
            },
            in: {
                $let: {
                    vars: {
                        "head": {
                            $cond: {
                                if: { $eq: ["$$siblingIndex", -1] },
                                then: array,
                                else: {
                                    $slice: [array, "$$siblingIndex"]
                                }
                            }
                        },
                        "tail": {
                            $cond: {
                                if: { $eq: ["$$siblingIndex", -1] },
                                then: [],
                                else: {
                                    '$slice': [array, { '$multiply': [-1, { '$subtract': [{ '$size': array }, '$$siblingIndex'] }] }]
                                }
                            }
                        }
                    },
                    in: { $concatArrays: ["$$head", elementOrEmpty, "$$tail"] }
                }
            }
        }
    };
}

function mapCells(rows, expression) {
    return {
        $map: {
            input: rows,
            as: "row",
            in: {
                $mergeObjects: [
                    "$$row",
                    {
                        cells: {
                            $map: {
                                input: "$$row.cells",
                                as: "cell",
                                in: expression
                            }
                        }
                    }
                ]
            }
        }
    };
}

function updateItem(rows, itemId, itemData) {
    return mapCells(rows, {
        $mergeObjects: [
            "$$cell",
            {
                items: {
                    $map: {
                        input: "$$cell.items",
                        as: "item",
                        in: {
                            $cond: {
                                if: { $ne: ["$$item.id", itemId] },
                                then: "$$item",
                                else: {
                                    $mergeObjects: [
                                        "$$item",
                                        itemData
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        ]
    });
}

function reduceCells(rows, initialValue, expression) {
    return {
        $reduce: {
            input: rows,
            initialValue: initialValue,
            in: {
                $reduce: {
                    input: "$$this.cells",
                    initialValue: "$$value",
                    in: {
                        $concatArrays: [
                            "$$value",
                            expression
                        ]
                    }
                }
            }
        }
    };
}

function getItemOrEmpty(rows, itemId) {
    return reduceCells(rows, [], {
        $filter: {
            input: "$$this.items",
            as: "item",
            cond: { $eq: ["$$item.id", itemId] }
        }
    });
}

function getItemPos(rows, itemId) {
    return reduceCells(rows, [], {
        $let: {
            vars: {
                itemIndex: { $indexOfArray: [ "$$this.items.id", itemId ] }
            },
            in: {
                $cond: {
                    if: { $eq: [ "$$itemIndex", -1] },
                    then: [],
                    else: [ {
                        $let: {
                            vars: {
                                siblingIndex: { $add: [ "$$itemIndex", 1 ] },
                            },
                            in: {
                                cellId: "$$this.id",
                                siblingId: {
                                    $cond: {
                                        if: { $lt: [ "$$siblingIndex", { $size: "$$this.items" } ] },
                                        then: { $arrayElemAt: [ "$$this.items.id", "$$siblingIndex" ] },
                                        else: null
                                    }
                                }
                            }
                        }
                    } ]
                }
            }
        }
    });
}

function addItem(rows, itemOrEmpty, cellId, siblingId) {
    return mapCells(rows,{
        $cond: {
            if: { $ne: ["$$cell.id", cellId] },
            then: "$$cell",
            else: {
                $mergeObjects: [
                    "$$cell",
                    { items: insertBefore("$$cell.items", itemOrEmpty, { "$indexOfArray": [ "$$cell.items.id", siblingId] }) }
                ]
            }
        }
    });
}

function deleteItem(rows, itemId) {
    return mapCells(rows, {
        $mergeObjects: [
            "$$cell",
            {
                items: {
                    $filter: {
                        input: "$$cell.items",
                        as: "item",
                        cond: { $ne: ["$$item.id", itemId] }
                    }
                }
            }
        ]
    });
}

exports.addItem = function (item, cellId, siblingId) {
    return [{
        $set: {
            rows: addItem("$rows", [item], cellId, siblingId)
        }
    }];
};

exports.moveItem = function (itemId, cellId, siblingId) {
    return [{
        $set: {
            rows: {
                $let: {
                    vars: {
                        itemOrEmpty: getItemOrEmpty("$rows", itemId),
                        filteredRows: deleteItem("$rows", itemId)
                    },
                    in: addItem("$$filteredRows", "$$itemOrEmpty", cellId, siblingId)
                }
            }
        }
    }];
};

exports.deleteItem = function (itemId) {
    return [{
        $set: {
            rows: deleteItem("$rows", itemId)
        }
    }];
};

exports.getItemPos = function (itemId) {
    return {
        result: getItemPos("$rows", itemId)
    };
};

exports.getItem = function (itemId) {
    return {
        result: getItemOrEmpty("$rows", itemId)
    };
};

exports.updateItem = function (itemId, data) {
    return [{
        $set: {
            rows: updateItem("$rows", itemId, data)
        }
    }];
};

function addRow(rows, rowOrEmpty, siblingId) {
    return insertBefore(rows, rowOrEmpty, { '$indexOfArray': ['$rows.id', siblingId] });
}

function getRowOrEmpty(rows, rowId) {
    return {
        $filter: {
            input: "$rows",
            as: "row",
            cond: { $eq: [ "$$row.id", rowId ] }
        }
    };
}

function deleteRow(rows, rowId) {
    return {
        $filter: {
            input: "$rows",
            as: "row",
            cond: { $ne: [ "$$row.id", rowId ] }
        }
    };
}

function getRowPos(rows, rowId) {
    return {
        $let: {
            vars: {
                rowIndex: { $indexOfArray: [ rows + ".id", rowId] }
            },
            in: {
                $cond: {
                    if: { $eq: ["$$rowIndex", -1] },
                    then: [],
                    else: [{
                        $let: {
                            vars: {
                                siblingIndex: { $add: ["$$rowIndex", 1] }
                            },
                            in: {
                                siblingId: {
                                    $cond: {
                                        if: { $lt: ["$$siblingIndex", { $size: rows }] },
                                        then: { $arrayElemAt: [rows + ".id", "$$siblingIndex"] },
                                        else: null
                                    }
                                }
                            }
                        }
                    }]
                }
            }
        }
    };
}

exports.addRow = function (row, siblingId) {
    return [{
        $set: {
            rows: addRow("$rows", [row], siblingId)
        }
    }];
};

exports.moveRow = function (rowId, siblingId) {
    return [{
        $set: {
            rows: {
                $let: {
                    vars: {
                        rowOrEmpty: getRowOrEmpty("$rows", rowId),
                        filteredRows: deleteRow("$rows", rowId)
                    },
                    in: addRow("$$filteredRows", "$$rowOrEmpty", siblingId)
                }
            }
        }
    }];
};

exports.deleteRow = function (rowId) {
    return [{
        $set: {
            rows: deleteRow($rows, rowId)
        }
    }];
};

exports.getRowPos = function (rowId) {
    return {
        result: getRowPos("$rows", rowId)
    };
};

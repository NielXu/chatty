const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.json());
const ROOM_NUMBER_LEN = 5;
const SUCCESS = 0, FAILED = 1;
let ROOMS = {};
/**
 * Rooms = {
 *      RoomNumber: {
 *          password: string (Hashed password for this room)
 *          users: [UID] (A list of users that joined this room)
 *      }
 * }
 */
let CLIENTS_POOL = {};
/**
 * CLIENTS_POOL = {
 *      UID (Unique ID for each user): {
 *          sock: The socket instance of this UID, each socket binds to one UID
 *          joined: RoomNumber (Room that this user is in)
 *          nickname: Nickname of this user
 *      }
 * }
 */

io.on('connection', function(socket){
    console.log(`Socket[${socket.id}]: connected`);

    socket.on('disconnect', function() {
        console.log(`Socket[${socket.id}]: disconnected`);
    });

    socket.on('register', function(request) {
        const { uid, nickname } = request;
        if(!uid) {
            socket.emit('register', {status: FAILED, message: 'Unrecognized user, UID is missing'});
        }
        else {
            registerUser(uid, socket, nickname);
            socket.emit('register', {status: SUCCESS});
        }
    });

    socket.on('unregister', function(request) {
        const { uid } = request;
        if(!uid) {
            socket.emit('unregister', {status: FAILED, message: 'Unrecognized user, UID is missing'});
        }
        else {
            unregisterUser(uid);
            socket.emit('unregister', {status: SUCCESS});
        }
    });

    socket.on('new_room', function(request) {
        const { uid, password } = request;
        if(!uid) {
            socket.emit('new_room', {status: FAILED, message: 'Unrecognized user, UID is missing'});
        }
        else if(!checkRegistered(uid)) {
            socket.emit('new_room', {status: FAILED, message: 'Unrecognized user, UID is not registered'});
        }
        else if(!password) {
            socket.emit('new_room', {status: FAILED, message: 'Require password to create a new room'});
        }
        else {
            const rid = newRoom(password);
            joinRoom(rid, uid, password);
            socket.emit('new_room', {status: SUCCESS, room: rid});
            socket.emit('join_room', {status: SUCCESS, room: rid});
        }
    });

    socket.on('join_room', function(request) {
        const { uid, room, password } = request;
        if(!uid) {
            socket.emit('join_room', {status: FAILED, message: 'Unrecognized user, UID is missing'});
        }
        else if(!checkRegistered(uid)) {
            socket.emit('join_room', {status: FAILED, message: 'Unrecognized user, UID is not registered'});
        }
        else if(!room) {
            socket.emit('join_room', {status: FAILED, message: 'Require room number to join'});
        }
        else if(!password) {
            socket.emit('join_room', {status: FAILED, message: 'Require password to join room'});
        }
        else {
            const result = joinRoom(room, uid, password);
            if(result) {
                socket.emit('join_room', {status: FAILED, message: result})
            }
            else {
                socket.emit('join_room', {status: SUCCESS, room: room});   
            }
        }
    });

    socket.on('leave_room', function(request) {
        const { uid } = request;
        if(!uid) {
            socket.emit('leave_room', {status: FAILED, message: 'Unrecognized user, UID is missing'});
        }
        else if(!checkRegistered(uid)) {
            socket.emit('leave_room', {status: FAILED, message: 'Unrecognized user, UID is not registered'});
        }
        else {
            const result = leaveRoom(uid);
            if(!result.success) {
                socket.emit('leave_room', {status: FAILED, message: result.message});
            }
            else {
                socket.emit('leave_room', {status: SUCCESS, room: result.room});
            }
        }
    });

    socket.on('message', function(request) {
        const { uid, message } = request;
        if(!uid) {
            socket.emit('message', {status: FAILED, message: 'Unrecognized user, UID is missing'});
        }
        else if(!checkRegistered(uid)) {
            socket.emit('message', {status: FAILED, message: 'Unrecognized user, UID is not registered'});
        }
        else if(!message) {
            socket.emit('message', {status: FAILED, message: 'No message to send'});
        }
        else {
            const result = sendMessage(uid, message);
            if(result.success) {
                socket.emit('message', {status: SUCCESS});
            }
            else {
                socket.emit('message', {status: FAILED, message: result.message});
            }
        }
    });

    socket.on('nickname', function(request) {
        const { uid, nickname } = request;
        if(!uid) {
            socket.emit('nickname', {status: FAILED, message: 'Unrecognized user, UID is missing'});
        }
        else if(!checkRegistered(uid)) {
            socket.emit('nickname', {status: FAILED, message: 'Unrecognized user, UID is not registered'});
        }
        else if(!nickname) {
            socket.emit('nickname', {status: FAILED, message: 'No nickname given'});
        }
        else {
            changeNickName(uid, nickname);
            socket.emit('nickname', {status: SUCCESS});
        }
    });

    socket.on('status', function(request) {
        const { uid } = request;
        if(!uid) {
            socket.emit('status', {status: FAILED, message: 'Unrecognized user, UID is missing'});
        }
        else if(!checkRegistered(uid)) {
            socket.emit('status', {status: FAILED, message: 'Unrecognized user, UID is not registered'});
        }
        else {
            socket.emit('status', {status: SUCCESS, detail: getStatus(uid)});
        }
    })
});

function getStatus(uid) {
    return {
        nickname: CLIENTS_POOL[uid].nickname,
        joined: CLIENTS_POOL[uid].joined? CLIENTS_POOL[uid].joined : "None"
    };
}

function changeNickName(uid, nickname) {
    CLIENTS_POOL[uid].nickname = nickname;
}

function sendMessage(uid, message) {
    const joined = CLIENTS_POOL[uid].joined;
    const nickname = CLIENTS_POOL[uid].nickname
    if(!joined) {
        return {success: false, message: "Did not join any room"};
    }
    else {
        const room = ROOMS[joined];
        const roomUsers = room.users;
        roomUsers.forEach(e => {
            // Dont send to itself
            if(e !== uid) {
                const sock = CLIENTS_POOL[e].sock;
                sock.emit('message', {status: SUCCESS, received: message, from: nickname});
            }
        });
        return {success: true};
    }
}

function registerUser(uid, sock, nickname) {
    if(!CLIENTS_POOL.hasOwnProperty(uid)) {
        CLIENTS_POOL[uid] = {
            sock: sock,
            joined: null,
            nickname: nickname? nickname : "anonymous"
        }
        console.log(`User[${uid}]: user registered, with socketID: ${sock.id}`);
    }
}

function unregisterUser(uid) {
    if(CLIENTS_POOL.hasOwnProperty(uid)) {
        const client = CLIENTS_POOL[uid];
        const joined = client['joined'];
        // Remove user from room if joined any
        if(joined) {
            const room = ROOMS[joined];
            const roomUsers = room['users'];
            roomUsers.splice(roomUsers.indexOf(uid), 1);
        }
        delete CLIENTS_POOL[uid];
        console.log(`User[${uid}]: user unregistered`);
    }
}

function checkRegistered(uid) {
    return CLIENTS_POOL.hasOwnProperty(uid);
}

function newRoom(password) {
    const rid = generateRoomID(ROOM_NUMBER_LEN);
    ROOMS[rid] = {
        password: password,
        users: []
    }
    return rid;
}

function leaveRoom(uid) {
    const joined = CLIENTS_POOL[uid]['joined']
    if(!joined) {
        return {success: false, message: `Did not join any room`};
    }
    const joinedUsers = ROOMS[joined].users;
    joinedUsers.splice(joinedUsers.indexOf(uid), 1);
    CLIENTS_POOL[uid]['joined'] = null;
    return {success: true, room: joined};
}

function joinRoom(rid, uid, password) {
    if(CLIENTS_POOL[uid]['joined'] === rid) {
        return `At room ${rid} already`;
    }
    if(ROOMS.hasOwnProperty(rid)) {
        if(ROOMS[rid].password === password) {
            ROOMS[rid].users.push(uid);
            CLIENTS_POOL[uid].joined = rid;
        }
        else {
            return `Incorrect password for room ${rid}`;
        }
    }
    else {
        return `Room ${rid} does not exists`;
    }
}

function generateRoomID(len) {
    let result = "";
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = chars.length;
    for(var i=0;i<len;i++) {
        result += chars.charAt(Math.floor(Math.random() * length));
    }
    // Avoid collision by keep generating id
    while(ROOMS.hasOwnProperty(result)) {
        result = "";
        for(var i=0;i<len;i++) {
            result += chars.charAt(Math.floor(Math.random() * length));
        }
    }
    return result;
}

http.listen(5000, function(){
    console.log('listening on port 5000');
});

setInterval(() => {
    console.log("Rooms:", JSON.stringify(ROOMS));
    console.log("Clients:", stringify(CLIENTS_POOL));
}, 5000);

function stringify(obj) {
    let result = "{";
    for(var key in obj) {
        const val = obj[key]
        if(typeof val === "object") {
            result += key + ": {"
            let count = 0;
            for(var innerKey in val) {
                const innerVal = val[innerKey];
                if(typeof innerVal !== "object") {
                    count += 1
                    result += innerKey + ": "
                    result += JSON.stringify(innerVal);
                }
            }
            result += "}"
            if(count > 1) {
                result += ", ";
            }
            else {
                result += " ";
            }
        }
        else {
            result += key + ": " + JSON.stringify(val);
        }
    }
    return result + "}";
}
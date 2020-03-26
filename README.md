# Chatty
Chatty is a chatting application that can be launched in terminal. It allows users to chat with others using commands from terminal, they can create room, leave room, join room, change their nickname and so on. It is still under development and only support local server.

# Get started
Install necessary dependencies
```sh
npm install
pip install -r requirements.txt
```

Start the server at local
```sh
node server.js
```

Start the client and make connection to the server:
```sh
python client.py
```

# Commands
- `$create <password>` Create a new room with the given password and automatically join it. The room number will be printed on the console, share it and let others to join your room.
- `$join <room> <password>` Join a room with the given password. If success, it will prompt that you have joined the room. Otherwise, error message will be printed on the console.
- `$leave` Leave the current room that you are in
- `$nick <nickname>` Change you nickname to the given one, default nickname for every user is "anonymous".
- `$status` Get your status, such as your nickname and the room that you are currently in
- `$quit` or `$exit` Exit the client application
- `<message>` If the input is not a command, it will be treated as a message and will be sent to the current room.
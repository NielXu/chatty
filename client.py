import socketio
import uuid
import sys
import signal


CLIENT = socketio.Client()
SUCCESS = 0
FAILED = 1
CLIENT.connect("http://localhost:5000")
UID = str(uuid.uuid4())
WELCOME_MESSAGE = """
Welcome to Chatty v0.0.1a, here are some useful commands:
    $create <password>: Create a room and automatically join
    $join <room> <password>: Join a room with password
    $leave <room>: Leave the current room
For more information, use $help.

"""


@CLIENT.event
def new_room(response):
    if response['status'] == SUCCESS:
        print("<Info> Successfully created new room:", response['room'])
    else:
        print("<Error>", response['message'])


@CLIENT.event
def join_room(response):
    if response['status'] == SUCCESS:
        print("<Info> Successfully joined room:", response['room'])
    else:
        print("<Error>", response['message'])


@CLIENT.event
def leave_room(response):
    if response['status'] == SUCCESS:
        print("<Info> Successfully left room:", response['room'])
    else:
        print("<Error>", response['message'])


@CLIENT.event
def register(response):
    if response['status'] == FAILED:
        print("<Error>", response['message'])


@CLIENT.event
def unregister(response):
    if response['status'] == SUCCESS:
        print("Successfully unregistered")
    else:
        print("<Error>", response['message'])


@CLIENT.event
def message(response):
    if response['status'] != SUCCESS:
        print("<Error>", response['message'])
    elif 'received' in response:
        print("<Received>", response['received'])


def cli_intepr(inp):
    "Interpreting input, do corresponding jobs"
    origin_inp = inp
    inp = inp.strip()
    splitted = inp.split()
    # Creating a new room with password
    if inp.startswith("$create"):
        if len(splitted) < 2:
            print("<Error> Require password to create a new room: $create <password>")
        else:
            CLIENT.emit('new_room', {'uid': UID, 'password': splitted[1]})
    elif inp.startswith("$join"):
        if len(splitted) < 2:
            print("<Error> Require room number to join: $join <room_number> <password>")
        elif len(splitted) < 3:
            print("<Error> Require password to join room: $join <room_number> <password>")
        else:
            CLIENT.emit('join_room', {'uid': UID, 'room': splitted[1], 'password': splitted[2]})
    elif inp.startswith("$leave"):
        CLIENT.emit('leave_room', {'uid': UID})
    else:
        if inp.startswith("$"):
            print("<Warn> $ usually used in commands")
        CLIENT.emit('message', {'uid': UID, 'message': origin_inp})


def REPL():
    CLIENT.emit("register", {'uid': UID})
    print(WELCOME_MESSAGE)
    while True:
        inp = input()
        if inp == "$exit" or inp == "$quit":
            CLIENT.emit("unregister", {'uid': UID})
            CLIENT.disconnect()
            print("<Info> Successfully shut down")
            break
        else:
            cli_intepr(inp)


def signal_handler(sig, frame):
    CLIENT.emit('unregister', {'uid': UID})
    CLIENT.disconnect()
    print("<Info> Successfully shut down")
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)
    REPL()

import functools

import flask


def login_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if "username" not in flask.session:  # Check if the user is logged in
            return {"needs_login": True}
        return f(*args, **kwargs)

    return decorated_function


def current_user() -> str:
    user = flask.session.get("username")
    assert user is not None
    return user

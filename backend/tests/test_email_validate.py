import email_validate


def test_allowed_providers():
    assert email_validate.is_allowed("ivan@gmail.com")
    assert email_validate.is_allowed("MARIA@abv.bg")
    assert email_validate.is_allowed("x@mail.bg")


def test_blocked():
    assert not email_validate.is_allowed("a@mailinator.com")   # disposable
    assert not email_validate.is_allowed("a@randomcorp.com")   # custom domain
    assert not email_validate.is_allowed("notanemail")
    assert not email_validate.is_allowed("")

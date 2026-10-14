PY ?= .venv/bin/python

.PHONY: check
check:
	$(PY) -m ruff check .
	$(PY) -m unittest discover -s tests

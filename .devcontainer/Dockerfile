FROM node:24-bookworm
# The official Node image does not guarantee ensurepip/python3-venv.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/*

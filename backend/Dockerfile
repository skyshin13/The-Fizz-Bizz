FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY requirements.txt .
RUN uv pip install --system --no-cache -r requirements.txt

COPY app/ ./app/
COPY docker_start.sh .
RUN chmod +x docker_start.sh

EXPOSE 8000

CMD ["/app/docker_start.sh"]

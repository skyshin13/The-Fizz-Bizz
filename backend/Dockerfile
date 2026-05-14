FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
COPY app/ ./app/

RUN pip install --no-cache-dir .

COPY docker_start.sh .
RUN chmod +x docker_start.sh

EXPOSE 8000

CMD ["/app/docker_start.sh"]

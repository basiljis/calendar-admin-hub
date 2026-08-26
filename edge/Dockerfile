FROM nginx:alpine

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY maintenance.html /usr/share/nginx/html/maintenance.html

RUN mkdir -p /etc/nginx/flags

ENV APP_DOMAIN=localhost \
    API_DOMAIN=api.localhost \
    SUPABASE_UPSTREAM=muuthcezvdaltiylcssh.supabase.co

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/__edge_health || exit 1

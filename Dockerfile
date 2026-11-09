FROM nginx:1.27-alpine

RUN mkdir -p /usr/share/nginx/html/vendor/bootstrap /usr/share/nginx/html/vendor/chartjs /usr/share/nginx/html/vendor/papaparse \
    && wget -qO /usr/share/nginx/html/vendor/bootstrap/bootstrap.min.css https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css \
    && wget -qO /usr/share/nginx/html/vendor/chartjs/chart.umd.min.js https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js \
    && wget -qO /usr/share/nginx/html/vendor/papaparse/papaparse.min.js https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js

COPY painel-cirurgia/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

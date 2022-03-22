# Workaround see https://github.com/docker/for-mac/issues/2155#issuecomment-571462709
# important "any arguments used in FROM commands need to be defined before the first build stage"
ARG COMPOSER_VERSION=2.2.7
FROM composer:${COMPOSER_VERSION} AS composerVersionWorkaround

FROM php:8.0.16-fpm-alpine3.14

ARG PHAN_VERSION=5.3.2
ARG PHP_DOCUMENTOR_VERSION=v3.3.0
ARG PHP_METRICS_VERSION=v2.7.3

#Phan
ADD https://github.com/phan/phan/releases/download/$PHAN_VERSION/phan.phar /usr/bin/phan
RUN chmod +rx /usr/bin/phan

# phpDocumentor
ADD https://github.com/phpDocumentor/phpDocumentor/releases/download/$PHP_DOCUMENTOR_VERSION/phpDocumentor.phar /usr/bin/phpDocumentor
RUN chmod +rx /usr/bin/phpDocumentor

#PhpMetrics
ADD https://github.com/phpmetrics/PhpMetrics/releases/download/$PHP_METRICS_VERSION/phpmetrics.phar /usr/bin/phpmetrics
RUN chmod +rx /usr/bin/phpmetrics

# COMPOSER
ENV COMPOSER_HOME=/composer
COPY --from=composerVersionWorkaround /usr/bin/composer /usr/bin/composer

RUN apk upgrade -U -a && apk add --no-cache npm
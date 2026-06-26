# syntax=docker/dockerfile:1.3
# Workaround see https://github.com/docker/for-mac/issues/2155#issuecomment-571462709
# important "any arguments used in FROM commands need to be defined before the first build stage"
ARG COMPOSER_VERSION=2.10.1
FROM composer:${COMPOSER_VERSION} AS composer-version-workaround

FROM php:8.5-fpm-alpine3.23

ARG PHAN_VERSION=6.0.5
ARG PHP_DOCUMENTOR_VERSION=v3.10.0
ARG PHP_METRICS_VERSION=v2.9.0
ARG DOCKER_PHP_EXTENSION_INSTALLER=2.11.12

#Phan
ADD --chmod=755 https://github.com/phan/phan/releases/download/$PHAN_VERSION/phan.phar /usr/bin/phan

# phpDocumentor
ADD --chmod=755 https://github.com/phpDocumentor/phpDocumentor/releases/download/$PHP_DOCUMENTOR_VERSION/phpDocumentor.phar /usr/bin/phpDocumentor

#PhpMetrics
ADD --chmod=755 https://github.com/phpmetrics/PhpMetrics/releases/download/$PHP_METRICS_VERSION/phpmetrics.phar /usr/bin/phpmetrics

# COMPOSER
ENV COMPOSER_HOME=/composer
COPY --from=composer-version-workaround /usr/bin/composer /usr/bin/composer

RUN apk upgrade -U -a && apk add --no-cache \
    nodejs-current \
    npm

ADD --chmod=0755 https://github.com/mlocati/docker-php-extension-installer/releases/download/$DOCKER_PHP_EXTENSION_INSTALLER/install-php-extensions /usr/local/bin/

RUN install-php-extensions xdebug

RUN echo 'memory_limit = 1024M' >> /usr/local/etc/php/conf.d/docker-php-memlimit.ini

WORKDIR /app

# avoid download prompt
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable pnpm && npm install -g corepack@latest

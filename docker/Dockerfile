# syntax=docker/dockerfile:1.3
# Workaround see https://github.com/docker/for-mac/issues/2155#issuecomment-571462709
# important "any arguments used in FROM commands need to be defined before the first build stage"
ARG COMPOSER_VERSION=2.8.8
FROM composer:${COMPOSER_VERSION} AS composer-version-workaround

FROM php:8.4-fpm-alpine3.21

ARG PHAN_VERSION=5.4.5
ARG PHP_DOCUMENTOR_VERSION=v3.7.1
ARG PHP_METRICS_VERSION=v2.8.1
ARG DOCKER_PHP_EXTENSION_INSTALLER=2.7.33

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
    npm

ADD --chmod=0755 https://github.com/mlocati/docker-php-extension-installer/releases/download/$DOCKER_PHP_EXTENSION_INSTALLER/install-php-extensions /usr/local/bin/

RUN install-php-extensions xdebug mbstring ctype

RUN echo 'memory_limit = 1024M' >> /usr/local/etc/php/conf.d/docker-php-memlimit.ini
RUN echo 'zend_extension=opcache' >> /usr/local/etc/php/conf.d/docker-php-ext-opcache.ini

WORKDIR /app

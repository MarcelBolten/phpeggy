<?php declare(strict_types=1);
$finder = PhpCsFixer\Finder::create()
    ->in('test')
;

$config = new PhpCsFixer\Config();

return $config->setRules(array(
    '@PSR12' => true,
    '@PHP73Migration' => true,
    ))
    ->setFinder($finder)
;

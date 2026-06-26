<?php declare(strict_types=1);
$finder = PhpCsFixer\Finder::create()
    ->in('test')
;

$config = new PhpCsFixer\Config();

return $config->setRules(array(
    '@PSR12' => true,
    '@PHP8x1Migration' => true,
    ))
    ->setFinder($finder)
;

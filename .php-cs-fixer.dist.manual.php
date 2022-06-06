<?php declare(strict_types=1);
$finder = PhpCsFixer\Finder::create()
    ->in('manual-test/output')
;

$config = new PhpCsFixer\Config();

return $config->setRules(array(
    '@PSR12' => true,
    '@PHP74Migration' => true,
    ))
    ->setFinder($finder)
;
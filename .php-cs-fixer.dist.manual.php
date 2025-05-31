<?php declare(strict_types=1);
$finder = PhpCsFixer\Finder::create()
    ->in('manual-test/output')
;

$config = new PhpCsFixer\Config();

return $config->setRules(array(
    '@PSR12' => true,
    '@PHP81Migration' => true,
    'method_argument_space' => false,
    ))
    ->setFinder($finder)
;

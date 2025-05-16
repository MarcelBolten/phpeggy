start = digits:[0-9]+ {
  return \intval(\implode('', $digits));
}
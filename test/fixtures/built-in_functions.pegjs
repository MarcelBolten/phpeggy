rule_1 =
  a:("lantern" {
    return ["location of " . $this->text(), $this->location()];
  })

  ws?

  b:rule_2

  {
    return [$a, $b, $this->location()];
  }

rule_2 =
  a:("velvet" {
    return ["range of " . $this->text(), $this->range()];
  })

  ws?

  b:rule_3

  ws?

  c:rule_4

  {
    return [$a, $b, $c, $this->location()];
  }

rule_3 =
  @("orbit" {
    return ["offset of " . $this->text(), $this->offset()];
  })

  ws?

rule_4 =
  @("maple" {
    return ["line of " . $this->text(), $this->line()];
  })

  ws?

  @("prism" {
    return ["column of " . $this->text(), $this->column()];
  })

  ws?

ws = [ \t\n\r]+

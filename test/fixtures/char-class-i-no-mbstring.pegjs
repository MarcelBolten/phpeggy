Document
  = Thing+

Thing
  = Letter_Or_Number

Letter_Or_Number
  = a:[a-z0-9]i {
    return ['rule' => 'Letter_Or_Number', 'value' => $a];
  }

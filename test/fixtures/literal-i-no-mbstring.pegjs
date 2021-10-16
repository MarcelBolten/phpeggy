Document
	= Case_Insensitive_Literal+

Case_Insensitive_Literal
	= "literal"i {
		return array('rule' => 'Case_Insensitive_Literal');
	}

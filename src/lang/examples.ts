export type Example = { readonly id: string; readonly title: string; readonly lesson: string; readonly source: string };

export const EXAMPLES: readonly Example[] = [
	{
		id: "arithmetic",
		title: "Arithmetic",
		lesson: "Multiplication runs before addition, and the left side runs first.",
		source: "(1 + 2) * 3 + 4 * 5",
	},
	{
		id: "apply-a-function",
		title: "Apply a function",
		lesson: "A function call puts the argument in place of the parameter.",
		source: String.raw`(\x -> x + 1) 41`,
	},
	{
		id: "let",
		title: "Name a value",
		lesson: "A let runs its value first, then puts that value in the body.",
		source: "let x = 2 + 3 in x * x",
	},
	{
		id: "if",
		title: "Choose a branch",
		lesson: "An if runs only its condition, then keeps one branch and drops the other.",
		source: "if 3 > 2 then 10 * 10 else 1 / 0",
	},
	{
		id: "two-arguments",
		title: "Two arguments",
		lesson: "A function of two arguments takes them one at a time.",
		source: String.raw`(\x y -> x * 10 + y) 4 2`,
	},
	{
		id: "functions-as-values",
		title: "Functions as values",
		lesson: "A function can take a function and call it twice.",
		source: String.raw`let twice = \f x -> f (f x) in twice (\n -> n * 3) 2`,
	},
	{
		id: "cons",
		title: "Build a list",
		lesson: "The colon puts one item at the front of a list.",
		source: "1 : 2 : [3]",
	},
	{
		id: "map",
		title: "Map",
		lesson: "Map turns a list into a row of calls, then each box runs from left to right.",
		source: String.raw`map (\x -> x * 2) [1, 2, 3]`,
	},
	{
		id: "filter",
		title: "Filter",
		lesson: "Filter asks each item a yes or no question and keeps the yeses.",
		source: String.raw`filter (\x -> x % 2 == 0) [1, 2, 3, 4]`,
	},
	{
		id: "foldr",
		title: "Fold from the right",
		lesson: "Foldr waits for the rest of the list before it combines each item.",
		source: "foldr (+) 0 [1, 2, 3]",
	},
	{
		id: "sum-of-squares",
		title: "Sum of squares",
		lesson: "Foldl carries a running total from the left, after map squares each box.",
		source: String.raw`foldl (+) 0 (map (\x -> x * x) [1, 2, 3])`,
	},
	{
		id: "pipeline",
		title: "A small pipeline",
		lesson: "Filter, then map, then fold, each one waiting for the list before it.",
		source: String.raw`let evens = filter (\x -> x % 2 == 0) [1, 2, 3, 4, 5, 6] in foldl (+) 0 (map (\x -> x * x) evens)`,
	},
];

import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SyntaxTree } from "@/components/charts/lib/biolang"
const parse = {
  tag: "S",
  children: [
    {
      tag: "NP",
      children: [
        { tag: "DT", word: "the" },
        { tag: "NN", word: "barber" },
      ],
    },
    {
      tag: "VP",
      children: [
        { tag: "VBD", word: "cut" },
        {
          tag: "NP",
          children: [
            { tag: "PRP$", word: "my" },
            { tag: "NN", word: "hair" },
          ],
        },
      ],
    },
  ],
}

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Constituency parse</CardTitle>
        <CardDescription>Phrase structure of a sentence</CardDescription>
      </CardHeader>
      <CardContent>
        <SyntaxTree root={parse} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Words at the leaves, phrases above <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Penn treebank tags
        </div>
      </CardFooter>
    </Card>
  )
}

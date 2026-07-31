import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ReadingLadder } from "@/components/charts/lib/edu"
const texts = [
  { title: "The Owl Who Was Afraid of the Dark", level: 3.1 },
  { title: "Charlotte's Web", level: 4.4 },
  { title: "The Iron Man", level: 4.0 },
  { title: "Skellig", level: 4.7 },
  { title: "Northern Lights", level: 5.6 },
  { title: "Holes", level: 4.6 },
  { title: "The Hobbit", level: 6.2 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Books against a reader</CardTitle>
        <CardDescription>Easy, just right, too hard</CardDescription>
      </CardHeader>
      <CardContent>
        <ReadingLadder texts={texts} readerLevel={4.2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The band is where learning happens <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Reading level 4.2
        </div>
      </CardFooter>
    </Card>
  )
}

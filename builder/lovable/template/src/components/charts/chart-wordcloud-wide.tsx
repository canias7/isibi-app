import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WordCloud, REVIEW_TERMS } from "./lib/wordcloud"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Word Cloud</CardTitle>
        <CardDescription>Wide and short, for a banner.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <WordCloud terms={REVIEW_TERMS} width={560} height={200} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          \u201cFriendly\u201d leads by a distance <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}

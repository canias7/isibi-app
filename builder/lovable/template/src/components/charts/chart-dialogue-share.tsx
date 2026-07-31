import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DialogueShare } from "@/components/charts/lib/media"
const characters = ["Mara", "Ivo", "Delacroix", "The Boy", "Nan"]
const lines = [
  [0, 182, 41, 96, 22],
  [174, 0, 18, 44, 9],
  [38, 16, 0, 4, 2],
  [88, 46, 3, 0, 31],
  [20, 8, 1, 29, 0],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Who talks to whom</CardTitle>
        <CardDescription>Lines split by interlocutor</CardDescription>
      </CardHeader>
      <CardContent>
        <DialogueShare characters={characters} lines={lines} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A big share with one partner is isolation <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Full script
        </div>
      </CardFooter>
    </Card>
  )
}

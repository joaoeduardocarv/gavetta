import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Film, Tv, Calendar, Star, Loader2 } from "lucide-react";
import { 
  getPersonDetails, 
  getPersonCredits, 
  getTMDBProfileUrl, 
  getTMDBImageUrl,
  TMDBPerson,
  TMDBPersonCredit 
} from "@/lib/tmdb";

interface PersonDetailDialogProps {
  personId: number | null;
  personName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectContent?: (credit: TMDBPersonCredit) => void;
}

export function PersonDetailDialog({ 
  personId, 
  personName, 
  open, 
  onOpenChange,
  onSelectContent 
}: PersonDetailDialogProps) {
  const [person, setPerson] = useState<TMDBPerson | null>(null);
  const [credits, setCredits] = useState<TMDBPersonCredit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && personId) {
      setLoading(true);
      Promise.all([
        getPersonDetails(personId),
        getPersonCredits(personId)
      ])
        .then(([personData, creditsData]) => {
          setPerson(personData);
          setCredits(creditsData);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, personId]);

  const handleCreditClick = (credit: TMDBPersonCredit) => {
    if (onSelectContent) {
      onSelectContent(credit);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Header com foto e info */}
            <div className="p-6 pb-4">
              <div className="flex gap-4">
                <Avatar className="h-24 w-24 rounded-xl flex-shrink-0">
                  <AvatarImage 
                    src={person?.profile_path ? getTMDBProfileUrl(person.profile_path) : undefined} 
                    alt={personName}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-2xl">
                    {personName.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-2">
                  <h2 className="font-heading text-xl font-bold text-foreground">
                    {personName}
                  </h2>
                  
                  {person?.known_for_department && (
                    <Badge variant="secondary">
                      {person.known_for_department === 'Acting' ? 'Ator/Atriz' : 
                       person.known_for_department === 'Directing' ? 'Diretor(a)' :
                       person.known_for_department}
                    </Badge>
                  )}

                  {person?.birthday && (
                    <p className="text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {new Date(person.birthday).toLocaleDateString('pt-BR')}
                    </p>
                  )}

                  {person?.place_of_birth && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {person.place_of_birth}
                    </p>
                  )}
                </div>
              </div>

              {person?.biography && (
                <p className="mt-4 text-sm text-muted-foreground line-clamp-3">
                  {person.biography}
                </p>
              )}
            </div>

            <Separator />

            {/* Filmografia */}
            <div className="flex-1 overflow-hidden">
              <div className="px-6 py-3">
                <h3 className="font-semibold text-sm">
                  Filmografia ({credits.length})
                </h3>
              </div>
              
              <ScrollArea className="h-[300px] px-6 pb-6">
                <div className="space-y-3">
                  {credits.map((credit) => (
                    <div
                      key={`${credit.media_type}-${credit.id}`}
                      className="flex gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => handleCreditClick(credit)}
                    >
                      <Avatar className="h-16 w-12 rounded-md flex-shrink-0">
                        <AvatarImage 
                          src={credit.poster_path ? getTMDBImageUrl(credit.poster_path, 'w200') : undefined}
                          alt={credit.title || credit.name}
                          className="object-cover"
                        />
                        <AvatarFallback className="rounded-md">
                          {credit.media_type === 'movie' ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {credit.title || credit.name}
                        </p>
                        
                        {(credit.character || credit.job) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {credit.character || credit.job}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            {credit.media_type === 'movie' ? <Film className="h-2.5 w-2.5 mr-1" /> : <Tv className="h-2.5 w-2.5 mr-1" />}
                            {credit.media_type === 'movie' ? 'Filme' : 'Série'}
                          </Badge>
                          
                          {(credit.release_date || credit.first_air_date) && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(credit.release_date || credit.first_air_date || '').getFullYear()}
                            </span>
                          )}

                          {credit.vote_average > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center">
                              <Star className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500 mr-0.5" />
                              {credit.vote_average.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {credits.length === 0 && !loading && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma obra encontrada
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

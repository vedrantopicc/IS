// src/components/EventCard.jsx
import { Calendar, Clock, MapPin } from "lucide-react";
import { Card, CardContent } from "./ui/card";

export default function EventCard({ 
  image, 
  title, 
  date, 
  time,
  location, // ✅ Lokacija je prisutna
  onClick,
  className = "",
  isPastEvent = false
}) {
  return (
    <Card className={`overflow-hidden bg-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] cursor-pointer ${isPastEvent ? 'opacity-75' : ''} ${className}`}>
      <div className="relative h-48 overflow-hidden">
        <img
          src={image || "https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=800"}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        {isPastEvent && (
          <div className="absolute top-2 right-2 bg-gray-600/90 text-white px-2 py-1 rounded-full text-xs font-medium">
            Past Event
          </div>
        )}
      </div>

      <CardContent className="p-6 space-y-4">
        <h3 className="text-xl font-bold text-gray-900 line-clamp-2 leading-tight">
          {title}
        </h3>

        {/* ✅ Lokacija — samo ako postoji */}
        {location && (
          <div className="flex items-center space-x-2 text-gray-600">
            <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-sm font-medium line-clamp-1">{location}</span>
          </div>
        )}

        {/* Datum i vreme */}
        <div className="flex flex-wrap items-center gap-4 text-gray-600">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-sm font-medium">{date}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-sm font-medium">{time}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <button 
            onClick={onClick} 
            className="px-4 py-2 !bg-blue-600 hover:!bg-blue-700 !text-white text-sm font-medium rounded-lg transition-colors duration-200 cursor-pointer w-full"
          >
            View Details
          </button>
        </div>
      </CardContent>
    </Card>
  );
}